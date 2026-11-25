import { eventBus } from '../../core/events';

let installed = false;

export function installOfflineBanner(): void {
  if (installed || typeof document === 'undefined') return;
  installed = true;

  const banner = document.createElement('div');
  banner.id = 'wf-offline-banner';
  banner.setAttribute('role', 'status');
  banner.style.display = 'none';
  banner.style.position = 'fixed';
  banner.style.top = '0';
  banner.style.left = '50%';
  banner.style.transform = 'translateX(-50%)';
  banner.style.zIndex = '9999';
  banner.style.maxWidth = 'min(760px, 94vw)';
  banner.style.padding = '10px 14px';
  banner.style.marginTop = '8px';
  banner.style.border = '1px solid #f59e0b';
  banner.style.borderRadius = '10px';
  banner.style.background = '#451a03';
  banner.style.color = '#fef3c7';
  banner.style.boxShadow = '0 10px 30px rgba(0,0,0,.35)';
  banner.style.fontSize = '13px';
  banner.style.alignItems = 'center';
  banner.style.gap = '12px';
  banner.innerHTML = '<span>⚠ Backend non raggiungibile: dati locali di sola lettura. Le modifiche non saranno salvate finché il servizio non torna online.</span><button type="button" id="wf-offline-dismiss" style="background:none;border:0;color:inherit;cursor:pointer;font-size:16px;">✕</button>';
  document.body.appendChild(banner);

  const dismiss = banner.querySelector('#wf-offline-dismiss');
  dismiss?.addEventListener('click', () => {
    banner.style.display = 'none';
  });

  eventBus.on('api:error', () => {
    banner.style.display = 'flex';
  });
  eventBus.on('api:result', () => {
    banner.style.display = 'none';
  });
}
