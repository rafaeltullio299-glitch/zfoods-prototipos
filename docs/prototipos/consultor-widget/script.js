/* ============================================================
   ZFOODS — Widget do Consultor Comercial
   Protótipo independente (sem Angular / backend).
   Pensado como referência para um futuro componente que carregará
   os dados do vendedor automaticamente a partir do cliente logado.
   ============================================================ */

(function () {
  'use strict';

  /** Vendedores do modo demonstração (equipe real da ZFOODS). */
  var SELLERS = [
    {
      id: 'keith',
      nome: 'Keith',
      foto: 'fotos/keith.jpg',
      whatsapp: '5551997033069',
      email: 'keith@zfoods.com.br',
    },
    {
      id: 'rafael',
      nome: 'Rafael Tullio',
      foto: 'fotos/rafael.jpg',
      whatsapp: '5551900000000',
      email: 'rafael.tullio@zfoods.com.br',
    },
    {
      id: 'paula',
      nome: 'Paula',
      foto: 'fotos/paula.jpg',
      whatsapp: '5551900000000',
      email: 'paula@zfoods.com.br',
    },
    {
      id: 'everaldo',
      nome: 'Everaldo',
      foto: 'fotos/everaldo.jpg',
      whatsapp: '5551999745095',
      email: 'everaldo@zfoods.com.br',
    },
  ];

  var WHATSAPP_MESSAGE =
    'Olá! Vim pelo catálogo da ZFOODS e gostaria de ajuda com meu pedido.';

  var WHATSAPP_LOADING_MS = 2000;

  /* ---------------------------------------------------------------
     Botão flutuante arrastável — apenas demonstração visual.
     Sem backend/persistência real: só localStorage do navegador.
     --------------------------------------------------------------- */
  var DRAG_THRESHOLD_PX = 6;
  var EDGE_MARGIN_PX = 16; // aproxima os breakpoints de --fab-size no CSS
  var POSITION_STORAGE_KEY = 'zfoods:consultantWidget:position';

  var state = {
    sellerIndex: 0,
    isOpen: false,
    whatsappOpening: false,
    dragging: false,
    dragMoved: false,
    justDragged: false,
    dragPointerId: null,
    dragStartX: 0,
    dragStartY: 0,
    fabStartLeft: 0,
    fabStartTop: 0,
  };

  var els = {};
  var lastFocusedBeforeOpen = null;

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    els.widget = document.getElementById('consultorWidget');
    els.fab = document.getElementById('consultorFab');
    els.fabPhoto = document.getElementById('fabPhoto');
    els.card = document.getElementById('consultorCard');
    els.cardClose = document.getElementById('cardClose');
    els.cardPhoto = document.getElementById('cardPhoto');
    els.cardName = document.getElementById('cardName');
    els.overlay = document.getElementById('consultorOverlay');
    els.btnWhatsapp = document.getElementById('btnWhatsapp');
    els.btnCall = document.getElementById('btnCall');
    els.btnEmail = document.getElementById('btnEmail');
    els.switcher = document.getElementById('sellerSwitcher');
    els.protoStrip = document.querySelector('.proto-strip');

    buildSwitcher();
    renderSeller(SELLERS[state.sellerIndex]);
    syncProtoStripHeight();
    window.addEventListener('resize', syncProtoStripHeight);

    els.btnWhatsappLabel = els.btnWhatsapp.querySelector('.cbtn__label');

    els.fab.addEventListener('click', handleFabClick);
    els.cardClose.addEventListener('click', closeCard);
    els.overlay.addEventListener('click', closeCard);
    els.btnWhatsapp.addEventListener('click', handleWhatsappClick);

    initDraggableFab();

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && state.isOpen) {
        closeCard();
      }
      if (event.key === 'Tab' && state.isOpen) {
        trapFocus(event);
      }
    });

    // Fecha ao clicar fora do card (desktop/tablet, onde não há overlay visível).
    // O seletor de demonstração fica de fora dessa regra: trocar de vendedor
    // com o card aberto deve apenas atualizar o conteúdo, sem fechá-lo.
    document.addEventListener('click', function (event) {
      if (!state.isOpen) return;
      var clickedInsideCard = els.card.contains(event.target);
      var clickedFab = els.fab.contains(event.target);
      var clickedSwitcher = els.switcher.contains(event.target);
      if (!clickedInsideCard && !clickedFab && !clickedSwitcher) {
        closeCard();
      }
    });
  }

  function syncProtoStripHeight() {
    if (!els.protoStrip) return;
    var height = els.protoStrip.getBoundingClientRect().height;
    document.documentElement.style.setProperty('--proto-strip-h', height + 'px');
  }

  function buildSwitcher() {
    SELLERS.forEach(function (seller, index) {
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'seller-chip';
      chip.setAttribute('aria-pressed', index === state.sellerIndex ? 'true' : 'false');

      var img = document.createElement('img');
      img.src = seller.foto;
      img.alt = '';

      var label = document.createElement('span');
      label.textContent = seller.nome;

      chip.appendChild(img);
      chip.appendChild(label);

      chip.addEventListener('click', function () {
        selectSeller(index);
      });

      els.switcher.appendChild(chip);
    });
  }

  function selectSeller(index) {
    state.sellerIndex = index;
    renderSeller(SELLERS[index]);

    var chips = els.switcher.querySelectorAll('.seller-chip');
    chips.forEach(function (chip, i) {
      chip.setAttribute('aria-pressed', i === index ? 'true' : 'false');
    });
  }

  function renderSeller(seller) {
    els.fabPhoto.src = seller.foto;
    els.fabPhoto.alt = 'Foto de ' + seller.nome;

    if (state.isOpen) {
      // Card já aberto: aplica uma transição suave de troca em vez de um "corte seco".
      els.cardPhoto.classList.add('is-swapping');
      els.cardName.classList.add('is-swapping');
      window.setTimeout(function () {
        els.cardPhoto.classList.remove('is-swapping');
        els.cardName.classList.remove('is-swapping');
      }, 260);
    }

    els.cardPhoto.src = seller.foto;
    els.cardPhoto.alt = 'Foto de ' + seller.nome;
    els.cardName.textContent = seller.nome;

    els.btnWhatsapp.href =
      'https://wa.me/' + seller.whatsapp + '?text=' + encodeURIComponent(WHATSAPP_MESSAGE);
    els.btnCall.href = 'tel:+' + seller.whatsapp;
    els.btnEmail.href = 'mailto:' + seller.email;

    document
      .getElementById('consultorFab')
      .setAttribute('aria-label', 'Falar com ' + seller.nome + ', consultor comercial ZFOODS');
  }

  function handleFabClick(event) {
    // Um "click" sintético é disparado pelo navegador logo após soltar o
    // ponteiro, mesmo quando houve arraste. Ignora esse clique fantasma.
    if (state.justDragged) {
      state.justDragged = false;
      event.preventDefault();
      return;
    }
    openCard();
  }

  /* ---------------------------------------------------------------
     Botão flutuante arrastável (demo).
     --------------------------------------------------------------- */

  function initDraggableFab() {
    restoreFabPosition();
    window.addEventListener('resize', clampFabPositionToViewport);
    els.fab.addEventListener('pointerdown', onFabPointerDown);
  }

  function onFabPointerDown(event) {
    if (event.button !== 0) return; // ignora clique direito/do meio do mouse

    var rect = els.fab.getBoundingClientRect();
    state.dragging = true;
    state.dragMoved = false;
    state.dragPointerId = event.pointerId;
    state.dragStartX = event.clientX;
    state.dragStartY = event.clientY;
    state.fabStartLeft = rect.left;
    state.fabStartTop = rect.top;

    try {
      els.fab.setPointerCapture(event.pointerId);
    } catch (err) {
      // Alguns navegadores/dispositivos recusam a captura para certos
      // ponteiros — o arraste ainda funciona pelos listeners abaixo.
    }
    els.fab.addEventListener('pointermove', onFabPointerMove);
    els.fab.addEventListener('pointerup', onFabPointerUp);
    els.fab.addEventListener('pointercancel', onFabPointerUp);
  }

  function onFabPointerMove(event) {
    if (!state.dragging || event.pointerId !== state.dragPointerId) return;

    var dx = event.clientX - state.dragStartX;
    var dy = event.clientY - state.dragStartY;

    if (!state.dragMoved) {
      // Só considera "arraste" depois de passar de um limiar mínimo —
      // é isso que diferencia um clique normal de um arraste real.
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
      state.dragMoved = true;
      els.fab.classList.add('is-dragging');
      els.widget.classList.add('is-dragging');
    }

    event.preventDefault();

    var rect = els.fab.getBoundingClientRect();
    var left = clamp(
      state.fabStartLeft + dx,
      EDGE_MARGIN_PX,
      window.innerWidth - rect.width - EDGE_MARGIN_PX
    );
    var top = clamp(
      state.fabStartTop + dy,
      minFabTop(),
      window.innerHeight - rect.height - EDGE_MARGIN_PX
    );

    applyFabPosition(left, top);
  }

  function onFabPointerUp(event) {
    if (!state.dragging || event.pointerId !== state.dragPointerId) return;

    try {
      els.fab.releasePointerCapture(event.pointerId);
    } catch (err) {
      // Em alguns navegadores (ex.: Safari/iOS em certas sequências) a
      // captura já foi liberada automaticamente antes do "pointerup"
      // chegar, e chamar release de novo lançaria erro. Ignora com segurança
      // — o resto da limpeza abaixo precisa rodar de qualquer forma.
    }
    els.fab.removeEventListener('pointermove', onFabPointerMove);
    els.fab.removeEventListener('pointerup', onFabPointerUp);
    els.fab.removeEventListener('pointercancel', onFabPointerUp);

    state.dragging = false;
    els.fab.classList.remove('is-dragging');
    els.widget.classList.remove('is-dragging');

    if (state.dragMoved) {
      // Marca para o handler de "click" (disparado logo em seguida pelo
      // navegador) ignorar esse clique fantasma e não abrir o card.
      state.justDragged = true;
      snapFabToNearestSide();
    }

    state.dragMoved = false;
    state.dragPointerId = null;
  }

  function snapFabToNearestSide() {
    var rect = els.fab.getBoundingClientRect();
    var center = rect.left + rect.width / 2;
    var isLeft = center < window.innerWidth / 2;
    var left = isLeft ? EDGE_MARGIN_PX : window.innerWidth - rect.width - EDGE_MARGIN_PX;
    var top = clamp(rect.top, minFabTop(), window.innerHeight - rect.height - EDGE_MARGIN_PX);

    els.fab.classList.add('is-settling');
    applyFabPosition(left, top);
    window.setTimeout(function () {
      els.fab.classList.remove('is-settling');
    }, 280);

    setWidgetSide(isLeft);
    savePosition(isLeft, top);
  }

  function restoreFabPosition() {
    var saved = readSavedPosition();
    if (!saved) return;

    var rect = els.fab.getBoundingClientRect();
    var top = clamp(
      saved.topRatio * window.innerHeight,
      minFabTop(),
      window.innerHeight - rect.height - EDGE_MARGIN_PX
    );
    var left =
      saved.side === 'left' ? EDGE_MARGIN_PX : window.innerWidth - rect.width - EDGE_MARGIN_PX;

    applyFabPosition(left, top);
    setWidgetSide(saved.side === 'left');
  }

  function clampFabPositionToViewport() {
    // Só reposiciona se o usuário já arrastou alguma vez — sem isso, o FAB
    // continua no canto padrão via CSS (right/bottom), que já acompanha o
    // viewport sozinho.
    if (!els.fab.style.left) return;

    var rect = els.fab.getBoundingClientRect();
    var left = clamp(rect.left, EDGE_MARGIN_PX, window.innerWidth - rect.width - EDGE_MARGIN_PX);
    var top = clamp(rect.top, minFabTop(), window.innerHeight - rect.height - EDGE_MARGIN_PX);
    applyFabPosition(left, top);
    setWidgetSide(left < window.innerWidth / 2);
  }

  function applyFabPosition(left, top) {
    els.fab.style.left = left + 'px';
    els.fab.style.top = top + 'px';
    els.fab.style.right = 'auto';
    els.fab.style.bottom = 'auto';
  }

  function setWidgetSide(isLeft) {
    els.widget.classList.toggle('is-left', isLeft);
    els.widget.classList.toggle('is-right', !isLeft);
  }

  function minFabTop() {
    var stripHeight = els.protoStrip ? els.protoStrip.getBoundingClientRect().height : 0;
    return stripHeight + 8;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function savePosition(isLeft, top) {
    try {
      var topRatio = top / window.innerHeight;
      window.localStorage.setItem(
        POSITION_STORAGE_KEY,
        JSON.stringify({ side: isLeft ? 'left' : 'right', topRatio: topRatio })
      );
    } catch (err) {
      // localStorage indisponível (modo privado, quota, etc.) — ignora.
    }
  }

  function readSavedPosition() {
    try {
      var raw = window.localStorage.getItem(POSITION_STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || (parsed.side !== 'left' && parsed.side !== 'right')) return null;
      if (typeof parsed.topRatio !== 'number' || isNaN(parsed.topRatio)) return null;
      return parsed;
    } catch (err) {
      return null;
    }
  }

  function openCard() {
    lastFocusedBeforeOpen = document.activeElement;
    state.isOpen = true;
    els.widget.classList.add('is-open');
    els.card.hidden = false;
    els.fab.setAttribute('aria-expanded', 'true');

    // Move o foco após a animação iniciar, para leitores de tela.
    window.requestAnimationFrame(function () {
      els.cardClose.focus();
    });
  }

  function closeCard() {
    state.isOpen = false;
    els.widget.classList.remove('is-open');
    els.fab.setAttribute('aria-expanded', 'false');

    // Aguarda a transição de saída antes de remover do fluxo de acessibilidade.
    window.setTimeout(function () {
      if (!state.isOpen) {
        els.card.hidden = true;
      }
    }, 480);

    if (lastFocusedBeforeOpen && typeof lastFocusedBeforeOpen.focus === 'function') {
      lastFocusedBeforeOpen.focus();
    } else {
      els.fab.focus();
    }
  }

  function handleWhatsappClick(event) {
    // Evita cliques repetidos abrindo várias abas/instâncias do WhatsApp
    // enquanto a primeira ainda está sendo processada pelo navegador/SO.
    if (state.whatsappOpening) {
      event.preventDefault();
      return;
    }

    state.whatsappOpening = true;
    els.btnWhatsapp.classList.add('is-loading');
    els.btnWhatsappLabel.textContent = 'Abrindo WhatsApp...';

    // O link continua funcionando normalmente (target="_blank" no desktop
    // mantém o catálogo na aba original; no mobile, o SO abre o app e o
    // navegador permanece no catálogo em segundo plano). Só reabilitamos
    // o botão depois de um tempo, para não travar o clique permanentemente
    // caso o usuário cancele a abertura do app/aba.
    window.setTimeout(function () {
      state.whatsappOpening = false;
      els.btnWhatsapp.classList.remove('is-loading');
      els.btnWhatsappLabel.textContent = 'Conversar no WhatsApp';
    }, WHATSAPP_LOADING_MS);
  }

  function trapFocus(event) {
    var focusable = els.card.querySelectorAll(
      'a[href], button:not([disabled])'
    );
    if (!focusable.length) return;

    var first = focusable[0];
    var last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
})();
