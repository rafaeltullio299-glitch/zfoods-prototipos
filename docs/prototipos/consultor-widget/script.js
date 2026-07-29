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

  var state = {
    sellerIndex: 0,
    isOpen: false,
    whatsappOpening: false,
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

    els.fab.addEventListener('click', openCard);
    els.cardClose.addEventListener('click', closeCard);
    els.overlay.addEventListener('click', closeCard);
    els.btnWhatsapp.addEventListener('click', handleWhatsappClick);

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
