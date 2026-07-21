/**
 * ZFoods — Central de Prototipos — comportamento compartilhado.
 * Sem dependencias externas, sem chamadas de rede: tudo simulado em memoria.
 */
(function () {
	'use strict';

	/* ── Tabs (data-tabs / data-tab / data-tab-panel) ─────────────────── */
	function initTabs(root) {
		root.querySelectorAll('[data-tabs]').forEach((group) => {
			// Paineis (data-tab-panel) podem estar dentro do proprio grupo ou
			// como irmaos do grupo, compartilhando o mesmo container pai.
			const scope = group.querySelector('[data-tab-panel]') ? group : group.parentElement || group;
			const buttons = group.querySelectorAll('[data-tab]');
			const panels = scope.querySelectorAll('[data-tab-panel]');
			buttons.forEach((btn) => {
				btn.addEventListener('click', () => {
					const target = btn.getAttribute('data-tab');
					buttons.forEach((b) => b.classList.toggle('is-active', b === btn));
					panels.forEach((p) =>
						p.classList.toggle('is-active', p.getAttribute('data-tab-panel') === target),
					);
					group.dispatchEvent(new CustomEvent('proto:tab-change', { detail: target }));
				});
			});
		});
	}

	/* ── Toast / snackbar ──────────────────────────────────────────────── */
	function toast(message, timeout) {
		let stack = document.querySelector('.toast-stack');
		if (!stack) {
			stack = document.createElement('div');
			stack.className = 'toast-stack';
			document.body.appendChild(stack);
		}
		const el = document.createElement('div');
		el.className = 'toast';
		el.textContent = message;
		stack.appendChild(el);
		requestAnimationFrame(() => el.classList.add('is-visible'));
		setTimeout(() => {
			el.classList.remove('is-visible');
			setTimeout(() => el.remove(), 220);
		}, timeout || 2600);
	}

	/* ── Drawer (carrinho, menu mobile) ───────────────────────────────── */
	function openDrawer(id) {
		document.getElementById(id)?.classList.add('is-open');
		document.getElementById(id + '-overlay')?.classList.add('is-open');
		document.body.style.overflow = 'hidden';
	}

	function closeDrawer(id) {
		document.getElementById(id)?.classList.remove('is-open');
		document.getElementById(id + '-overlay')?.classList.remove('is-open');
		document.body.style.overflow = '';
	}

	/* ── Modal ─────────────────────────────────────────────────────────── */
	function openModal(id) {
		document.getElementById(id)?.classList.add('is-open');
	}

	function closeModal(id) {
		document.getElementById(id)?.classList.remove('is-open');
	}

	/* ── Stepper simples (checkout) ───────────────────────────────────── */
	function goToStep(stepIndex) {
		document.querySelectorAll('[data-step]').forEach((el) => {
			const idx = Number(el.getAttribute('data-step'));
			el.classList.toggle('is-active', idx === stepIndex);
			el.classList.toggle('is-done', idx < stepIndex);
		});
		document.querySelectorAll('[data-step-panel]').forEach((el) => {
			const idx = Number(el.getAttribute('data-step-panel'));
			el.style.display = idx === stepIndex ? '' : 'none';
		});
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	/* ── Marca o link ativo da navbar/sidebar pelo data-current ─────────── */
	function markActiveNav() {
		const current = document.body.getAttribute('data-current');
		if (!current) return;
		document.querySelectorAll('[data-nav]').forEach((a) => {
			a.classList.toggle('is-active', a.getAttribute('data-nav') === current);
		});
	}

	/* ── Contador de quantidade (+/-) ─────────────────────────────────── */
	function initQtyControls(root) {
		root.querySelectorAll('[data-qty]').forEach((wrap) => {
			const input = wrap.querySelector('input');
			wrap.querySelectorAll('button').forEach((btn) => {
				btn.addEventListener('click', () => {
					const delta = btn.getAttribute('data-qty-action') === 'inc' ? 1 : -1;
					const min = Number(input.min || 1);
					const next = Math.max(min, Number(input.value || 1) + delta);
					input.value = next;
					input.dispatchEvent(new Event('change'));
				});
			});
		});
	}

	document.addEventListener('DOMContentLoaded', () => {
		initTabs(document);
		initQtyControls(document);
		markActiveNav();

		document.querySelectorAll('[data-open-drawer]').forEach((btn) => {
			btn.addEventListener('click', () => openDrawer(btn.getAttribute('data-open-drawer')));
		});
		document.querySelectorAll('[data-close-drawer]').forEach((btn) => {
			btn.addEventListener('click', () => closeDrawer(btn.getAttribute('data-close-drawer')));
		});
		document.querySelectorAll('[data-open-modal]').forEach((btn) => {
			btn.addEventListener('click', () => openModal(btn.getAttribute('data-open-modal')));
		});
		document.querySelectorAll('[data-close-modal]').forEach((btn) => {
			btn.addEventListener('click', () => closeModal(btn.getAttribute('data-close-modal')));
		});
		document.querySelectorAll('[data-goto-step]').forEach((btn) => {
			btn.addEventListener('click', () => goToStep(Number(btn.getAttribute('data-goto-step'))));
		});
		document.querySelectorAll('[data-toast]').forEach((btn) => {
			btn.addEventListener('click', () => toast(btn.getAttribute('data-toast')));
		});
	});

	// API exposta para uso inline nos prototipos
	window.Proto = { toast, openDrawer, closeDrawer, openModal, closeModal, goToStep, initTabs };
})();
