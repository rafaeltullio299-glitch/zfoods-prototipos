# DEMANDA FINAL — WIDGET DO VENDEDOR ZFOODS

| | |
|---|---|
| **Status** | Especificação fechada — pronta para orçamento e implementação |
| **Escopo desta etapa** | Widget do vendedor comercial no catálogo. Contato financeiro fica para uma segunda etapa. |
| **Base** | Diagnóstico técnico do protótipo `docs/prototipos/consultor-widget` + regras de negócio definidas pelo responsável do produto |

---

## 1. Objetivo da funcionalidade

Quando um cliente autenticado navega pelo catálogo ZFOODS, o sistema deve identificar automaticamente **o vendedor responsável por aquele cliente** e exibir um widget de atendimento personalizado (foto, nome, cargo, horário e botão de WhatsApp), substituindo o contato genérico da empresa.

Cada cliente tem **um único vendedor responsável**. Esse vínculo é feito pelo CPF/CNPJ do vendedor, informado no cadastro do cliente no ERP Sentus.

## 2. Fluxo de funcionamento

1. Cliente autentica no catálogo ZFOODS.
2. O backend identifica o participante correspondente no Sentus e obtém o documento do representante vinculado a ele — campo referido como `docRepresentante` nos dados do cliente. Internamente, esse valor já é sincronizado e armazenado em `participantes.repres_documento` (**mesma informação, diferença apenas de nomenclatura entre o dado de origem e a coluna interna**).
3. O documento é normalizado: somente dígitos, sem pontuação, **preservando zeros à esquerda**, sempre tratado como `string`/`varchar` (nunca como número).
4. O backend procura esse documento normalizado na tabela interna de vendedores (`commercial_consultants`).
5. Se encontrar um vendedor **ativo**, devolve os dados sanitizados desse vendedor.
6. Se não encontrar, ou se o vendedor estiver **inativo**, devolve os dados do **contato geral da ZFOODS** (mesmo formato de resposta, sem exceção).
7. O frontend renderiza sempre o mesmo componente — ele não sabe (nem precisa saber) se está exibindo o vendedor pessoal ou o contato geral.

Resolução técnica: **em tempo real, a cada requisição**, comparando `clientes.documento` (normalizado) do cliente logado com `participantes.documento` (normalizado) para obter `repres_documento`, e então buscando esse documento normalizado em `commercial_consultants`. Não haverá, nesta primeira entrega, nenhuma coluna de vínculo permanente (FK) entre cliente e vendedor — a resolução é sempre calculada na hora.

## 3. Banco de dados

### Nova tabela `commercial_consultants`

| Coluna | Tipo | Observações |
|---|---|---|
| `id` | `uuid` (default `gen_random_uuid()`) | PK |
| `full_name` | `varchar(200) not null` | |
| `representative_document` | `varchar(20) not null` | Como cadastrado (com ou sem máscara) |
| `representative_document_normalized` | `varchar(20) not null` | Somente dígitos, zeros à esquerda preservados |
| `whatsapp` | `varchar(20) not null` | Obrigatório — todo vendedor ativo tem WhatsApp |
| `phone` | `varchar(20)` | Opcional |
| `email` | `varchar(200)` | Opcional |
| `role` | `varchar(100) not null default 'Consultor Comercial ZFOODS'` | |
| `photo_url` | `text` | Opcional — Supabase Storage |
| `is_default` | `boolean not null default false` | Marca o registro usado como **contato geral da ZFOODS** (fallback). Apenas um registro pode ter `true`. |
| `is_active` | `boolean not null default true` | Exclusão lógica |
| `created_at` / `updated_at` | `timestamptz` | |

- Índice único parcial em `representative_document_normalized` (`WHERE is_active = true`) — impede dois vendedores ativos com o mesmo documento.
- RLS: políticas `admin_*` para escrita (mesmo padrão de `categorias_produto`/`configuracoes_sistema`); leitura pública restrita a uma *view* que **não** exponha `representative_document`/`representative_document_normalized`.

### Storage

- Bucket `consultant-photos`, replicando exatamente as políticas já usadas em `product-images` (leitura pública, escrita restrita a `service_role`/admin).

### Sem alterações em `participantes` ou `clientes`

- `participantes.repres_documento`/`repres_status` já existem e já são sincronizados do Sentus — não requerem nenhuma migration nova.
- O backend precisa apenas de **acesso de leitura** ao campo `documento` do cliente logado (hoje a entidade de leitura de `clientes` usada no backend não expõe esse campo — ver seção 4).

## 4. Backend

- Novo pacote `consultant/` (entidade `CommercialConsultant`, repository, service, controller), seguindo o padrão dos pacotes já existentes (`categoria/`, `produto/`).
- Estender a entidade de leitura de `clientes` para incluir o campo `documento` (necessário para a resolução em tempo real).
- **Endpoint `GET /api/v1/consultant/me`** (autenticado via JWT Supabase, mesmo `SupabaseJwtConverter` já usado no projeto):
  1. Extrai o `sub` do JWT (id do cliente autenticado);
  2. Busca `clientes.documento`, normaliza;
  3. Busca em `participantes` o registro com esse documento normalizado e obtém `repres_documento`/`repres_status`;
  4. Se `repres_status = 'ATIVO'`, normaliza `repres_documento` e busca em `commercial_consultants` (`is_active = true`);
  5. Encontrado → devolve os dados do vendedor;
  6. Não encontrado (cliente sem representante, representante não cadastrado, ou vendedor inativo) → devolve o registro com `is_default = true`.
- Nunca aceitar documento, CPF ou ID de cliente vindos do corpo da requisição — a identidade vem exclusivamente do JWT.
- Formato de resposta (mesmo shape em qualquer cenário):

```json
{
  "vendedor": {
    "nome": "Keith",
    "fotoUrl": "https://.../consultant-photos/keith.jpg",
    "whatsapp": "5551997033069",
    "telefone": "5551997033069",
    "email": "keith@zfoods.com.br",
    "cargo": "Consultor Comercial ZFOODS",
    "horarioAtendimento": "Segunda a sexta-feira, das 08h às 17h",
    "contatoGeral": false
  }
}
```

- `contatoGeral: true` quando o retorno for o fallback — permite QA validar o cenário sem expor nenhum dado sensível.
- **Nunca** incluir `representative_document`/`representative_document_normalized` (nem qualquer variação de CPF/CNPJ) nesse payload.
- Endpoints administrativos (protegidos por role admin):
  - `GET /api/v1/admin/consultants` (listar)
  - `POST /api/v1/admin/consultants` (criar)
  - `PUT /api/v1/admin/consultants/{id}` (editar)
  - `PATCH /api/v1/admin/consultants/{id}/status` (ativar/desativar)
  - Marcar/desmarcar `is_default` (o service deve garantir que só exista um registro com `is_default = true` por vez — ao marcar um novo, desmarca o anterior automaticamente).
- Validação de negócio no backend: não permitir salvar um vendedor como **ativo** sem WhatsApp preenchido.
- Log técnico (sem CPF completo) quando o fallback for utilizado por falta de vendedor vinculado ou por vendedor inativo — útil para acompanhamento administrativo, não bloqueia o fluxo do cliente.

## 5. Frontend

- **Um único componente Angular reutilizável** (`consultant-widget`), standalone, `OnPush`, zoneless-safe, com estado em signals.
- Serviço de estado (`ConsultantStore`) que busca `GET /api/v1/consultant/me` ao autenticar e limpa o estado ao deslogar; expõe um `signal` com os dados do vendedor (pessoal ou contato geral).
- Montagem **única** dentro do layout público (`PublicLayoutComponent`), ao lado do componente do carrinho — como catálogo, produto, carrinho e checkout já vivem dentro desse mesmo layout, o widget aparece automaticamente em todas essas áreas, sem precisar ser inserido tela por tela.
- Comportamento a reescrever em Angular (o protótipo é referência visual/comportamental — **o JavaScript do protótipo não deve ser importado ou reaproveitado diretamente**, apenas usado como guia):
  - Botão flutuante (FAB) fixo no canto inferior direito → abre um card;
  - Desktop: card ancorado próximo ao FAB; mobile: *bottom sheet* subindo da base, com overlay;
  - Fechar por: botão de fechar, `Esc`, clique fora, ou clique no overlay (mobile);
  - Gerenciamento de foco acessível (foco vai para o botão de fechar ao abrir; retorna ao elemento anterior ao fechar; navegação por Tab presa dentro do card enquanto aberto);
  - Botão **"Conversar no WhatsApp"** como ação primária: abre `https://wa.me/<whatsapp>?text=<mensagem>` em nova aba (`target="_blank" rel="noopener noreferrer"`), com um estado de carregamento breve ("Abrindo WhatsApp...") para evitar cliques repetidos. Como o link nunca navega a aba atual, o estado do catálogo/carrinho é preservado automaticamente ao voltar do WhatsApp — não é necessário nenhum mecanismo adicional de restauração de estado;
  - Botões secundários `tel:` (sempre) e `mailto:` (somente quando o vendedor tiver e-mail cadastrado);
  - Avatar: exibe a foto do vendedor; quando não houver `fotoUrl`, exibe um avatar com as **iniciais do nome** (nunca uma `<img>` quebrada);
  - Horário de atendimento exibido como texto fixo: **"Segunda a sexta-feira, das 08h às 17h"** (não é um dado vindo do backend nesta etapa — é texto estático no componente);
  - Respeitar `prefers-reduced-motion` nas transições.

### Mensagem contextual do WhatsApp

A mensagem pré-preenchida do botão "Conversar no WhatsApp" deve ser montada **dinamicamente pelo próprio componente**, de acordo com a página/contexto em que o cliente está no momento do clique — sem exigir nenhuma seleção manual do cliente e **sem criar componentes diferentes por tela**. O objetivo é permitir que o vendedor se antecipe à dúvida do cliente.

| Contexto | Mensagem |
|---|---|
| Página de produto | `Olá [nome do vendedor], estou vendo este produto no catálogo da ZFOODS:`<br>`[nome do produto]`<br>`[URL do produto]`<br>`Gostaria de tirar uma dúvida.` |
| Catálogo/listagem | `Olá [nome do vendedor], estou navegando pelo catálogo da ZFOODS e gostaria de tirar uma dúvida.` |
| Carrinho | `Olá [nome do vendedor], estou com uma dúvida sobre meu carrinho no catálogo da ZFOODS.` |
| Checkout | `Olá [nome do vendedor], estou finalizando um pedido no catálogo da ZFOODS e gostaria de tirar uma dúvida.` |

Regras de implementação:

- `[nome do vendedor]` vem do payload de `/consultant/me`; quando o retorno for o contato geral (`contatoGeral: true`), a saudação é adaptada para não citar um nome próprio (ex.: "Olá! ...").
- `[URL do produto]` é a URL completa e absoluta da página do produto (com domínio) — precisa ser clicável dentro do WhatsApp.
- A identificação do contexto é **automática**, obtida a partir da rota ativa (`Router`/`ActivatedRoute`) e, na página de produto, dos dados do produto já carregados na tela. O cliente nunca seleciona nem digita de onde está vindo.
- Continua sendo **um único componente** (`consultant-widget`): a montagem da mensagem é uma função/`computed()` interna derivada da rota atual, não uma variação visual nem um componente separado por tela.
- **Nunca** incluir CPF, CNPJ, limite de crédito ou qualquer outro dado sensível do cliente na mensagem.
- Nesta primeira versão, o conteúdo do carrinho **não** é enviado automaticamente na mensagem (nem itens, nem valores, nem quantidade) — apenas o texto fixo indicando que a dúvida é sobre o carrinho.
- A mensagem final é sempre passada por `encodeURIComponent` antes de compor a URL `wa.me`.
- O link continua abrindo em nova aba (`target="_blank" rel="noopener noreferrer"`), preservando o estado do catálogo/carrinho ao voltar do WhatsApp — isso não muda com a mensagem contextual.

- Cuidado de posicionamento/z-index no checkout: o widget nunca pode cobrir o botão de finalizar compra ou qualquer ação principal de compra — validar visualmente em todas as telas onde aparece.
- Identidade visual: reaproveitar a paleta e a tipografia já validadas no protótipo (`docs/prototipos/consultor-widget.css`), mas usando os tokens reais do projeto (`src/material-theme.scss`) em vez de redefini-los.

## 6. Tela administrativa de vendedores

- Rota sugerida: `/admin/consultores` (a confirmar — ver seção 11).
- Funcionalidades:
  - Listar vendedores (foto, nome, WhatsApp, status ativo/inativo, indicação de "contato padrão");
  - Cadastrar e editar vendedor;
  - Ativar/desativar (exclusão lógica via `is_active`);
  - Marcar um vendedor como **contato padrão da ZFOODS** (fallback) — apenas um por vez;
  - Pesquisar por nome, telefone ou CPF/CNPJ;
  - Validação amigável de CPF/CNPJ duplicado antes do submit (além da constraint de banco).
- Campos do formulário: nome completo (obrigatório), CPF/CNPJ do representante (obrigatório, único, usado só para vínculo interno), WhatsApp (obrigatório para ativar), telefone (opcional), e-mail (opcional), cargo (default "Consultor Comercial ZFOODS", editável), foto (upload com recorte 1:1 e pré-visualização), status ativo/inativo, marcação de contato padrão.
- Esta é uma tela **interna/administrativa** — diferente do widget público, aqui o CPF/CNPJ do vendedor é normalmente visível e editável pelo admin, pois é uma ferramenta de cadastro, não de exibição ao cliente.
- Sem exclusão física nesta etapa — o caminho padrão é sempre desativar.

## 7. Regras de fallback

| Cenário | Comportamento |
|---|---|
| Cliente sem `docRepresentante`/vendedor vinculado | Contato geral da ZFOODS (`is_default = true`) |
| Documento do vendedor não cadastrado em `commercial_consultants` | Contato geral da ZFOODS |
| Vendedor cadastrado, porém inativo | Contato geral da ZFOODS |
| Vendedor ativo sem foto | Avatar com iniciais do nome |
| Vendedor ativo | Sempre tem WhatsApp cadastrado (obrigatório na tela admin) — nenhum tratamento adicional de "vendedor sem WhatsApp" é necessário |

Em todos os cenários de fallback, o backend responde no **mesmo formato** — o frontend nunca precisa de um tratamento especial para "sem vendedor".

## 8. Segurança e proteção de dados

- O CPF/CNPJ do vendedor (`representative_document`/`representative_document_normalized`) e o documento do cliente usados na resolução do vínculo **nunca** trafegam para o frontend público — são usados exclusivamente no backend.
- O endpoint `GET /api/v1/consultant/me` resolve o vendedor **somente** a partir do `sub` do JWT autenticado — nunca aceita documento ou identificador de cliente vindo do corpo da requisição (evita um cliente consultar o vendedor de outro).
- `public.participantes` permanece `service_role`-only (RLS já nega acesso a `anon`/`authenticated`) — nenhuma consulta a essa tabela deve partir do frontend.
- `commercial_consultants`: RLS com políticas `admin_*` para escrita; leitura pública (se necessária) somente via *view* sem as colunas de documento.
- Upload de foto: validar tipo e tamanho de arquivo no backend, não apenas no client.
- Logs técnicos nunca devem registrar o CPF/CNPJ completo — preferir "documento não encontrado" ou os últimos dígitos.

## 9. Critérios de aceite

1. Cliente autenticado com vendedor vinculado e ativo vê os dados **desse** vendedor no widget.
2. O CPF/CNPJ é comparado sem pontuação, preservando zeros à esquerda.
3. O CPF/CNPJ do vendedor (e do cliente) não aparece em nenhuma resposta de API consumida pelo frontend, nem em nenhuma tela do catálogo.
4. O widget aparece em: catálogo, listagem de produtos, página de produto, carrinho e checkout, sem cobrir nenhum CTA de compra.
5. O botão "Conversar no WhatsApp" abre o número correto do vendedor vinculado, em nova aba, sem perder o estado do catálogo/carrinho.
6. Cliente sem vendedor vinculado recebe o contato geral da ZFOODS, sem erro visível.
7. Vendedor inativo nunca é exibido — contato geral no lugar.
8. Vendedores sem foto exibem avatar com iniciais, nunca uma imagem quebrada.
9. O horário de atendimento exibido é sempre "Segunda a sexta-feira, das 08h às 17h".
10. A tela administrativa permite cadastrar, editar, ativar/desativar e definir o contato padrão, com validação de WhatsApp obrigatório para ativação.
11. O widget é um único componente Angular, reutilizado (não duplicado) em todas as áreas onde aparece.
12. Ao clicar no WhatsApp em uma página de produto, a mensagem contém corretamente o nome e o link daquele produto.
13. No catálogo, no carrinho e no checkout, a mensagem identifica corretamente a origem do contato.
14. Nenhum dado sensível (CPF, CNPJ, limite de crédito, conteúdo do carrinho) é incluído na mensagem.
15. O contexto é obtido automaticamente pelo componente, sem o cliente precisar selecionar ou digitar de qual tela está vindo.

## 10. Arquivos/protótipos de referência

- `docs/prototipos/consultor-widget.html` — estrutura e comportamento visual do FAB e do card (ignorar a réplica do catálogo e a faixa de demonstração de troca de vendedor, que não fazem parte do produto).
- `docs/prototipos/consultor-widget.css` — paleta, tipografia, animações, responsivo (desktop vs. mobile), estados de acessibilidade. Usar como referência de design; os tokens de cor devem ser unificados com `src/material-theme.scss` na implementação real.
- `docs/prototipos/consultor-widget.js` — referência de **comportamento** (abrir/fechar, foco, debounce do WhatsApp). **Não deve ser integrado diretamente** — a lógica precisa ser reescrita como componente Angular (signals, sem manipulação direta do DOM).
- `docs/prototipos/assets/` (logo e fotos de exemplo) — apenas para preview durante o desenvolvimento; fotos reais dos vendedores virão do cadastro administrativo.

## 11. Pontos que o desenvolvedor precisa confirmar antes de iniciar

- [ ] Quem será o **contato padrão (fallback) da ZFOODS**: nome, foto e número de WhatsApp a cadastrar como `is_default`.
- [ ] Confirmar, no ambiente real da ZFOODS, qual endpoint Sentus está sendo usado hoje para obter o `docRepresentante` do cliente (garantir que o campo já sincronizado em `participantes.repres_documento` reflete esse dado corretamente).
- [ ] Confirmar a saudação usada na mensagem quando o contato exibido for o **contato geral** (fallback, sem vendedor pessoal vinculado) — os textos-base da seção 5 usam `[nome do vendedor]`, que precisa de uma variação para esse cenário (ex.: manter só "Olá!", sem nome próprio).
- [ ] Nome definitivo da rota administrativa: `/admin/consultores` (padrão de idioma do domínio) ou `/admin/consultants` (padrão técnico em inglês usado nas demais rotas admin).
- [ ] Padrão de upload de foto já usado hoje para produtos, para reaproveitar exatamente o mesmo fluxo no cadastro de vendedores.
- [ ] Nome definitivo do bucket de fotos (sugestão: `consultant-photos`) e limites de tamanho/tipo de arquivo.
- [ ] Confirmar se o campo "cargo" deve ser sempre fixo ("Consultor Comercial ZFOODS") ou editável por vendedor no cadastro.
