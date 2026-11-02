// Third-party frames exist only after explicit activation, never on page load.
(function () {
  'use strict';
  var tabs = Array.from(document.querySelectorAll('.tab-btn'));
  var providers = {
    fb: { title: 'Facebook-Beiträge von Schmuckkultur Weiss', src: 'https://www.facebook.com/plugins/likebox.php?href=https%3A%2F%2Fwww.facebook.com%2Fschmuckkulturweiss&width=300&height=360&colorscheme=light&show_faces=false&header=false&stream=true&show_border=false' },
    ig: { title: 'Instagram-Profil von Schmuckkultur Weiss', src: 'https://www.instagram.com/schmuckkultur.weiss/embed' }
  };
  function close(panel, focus) {
    panel.querySelector('.feed-embed').replaceChildren();
    panel.querySelector('.feed-embed').hidden = true;
    panel.querySelector('.feed-intro').hidden = false;
    panel.querySelector('.feed-close').hidden = true;
    panel.querySelector('.feed-fallback').hidden = true;
    if (focus) panel.querySelector('.feed-load').focus();
  }
  function select(tab) {
    tabs.forEach(function (button) {
      var on = button === tab;
      button.classList.toggle('on', on);
      button.setAttribute('aria-selected', String(on));
      button.tabIndex = on ? 0 : -1;
      var panel = document.getElementById(button.getAttribute('aria-controls'));
      if (!on) close(panel, false);
      panel.hidden = !on;
    });
  }
  tabs.forEach(function (tab, index) {
    tab.addEventListener('click', function () { select(tab); });
    tab.addEventListener('keydown', function (event) {
      var next = event.key === 'ArrowRight' ? (index + 1) % tabs.length :
        event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length :
        event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1;
      if (next < 0) return;
      event.preventDefault(); select(tabs[next]); tabs[next].focus();
    });
  });
  document.querySelectorAll('.feed-load').forEach(function (button) {
    button.hidden = false;
    var panel = button.closest('.feed-slot');
    var closeButton = panel.querySelector('.feed-close');
    button.addEventListener('click', function () {
      var provider = providers[button.dataset.provider];
      var frame = document.createElement('iframe');
      frame.title = provider.title;
      frame.height = '360';
      frame.referrerPolicy = 'no-referrer';
      frame.src = provider.src;
      panel.querySelector('.feed-embed').replaceChildren(frame);
      panel.querySelector('.feed-embed').hidden = false;
      panel.querySelector('.feed-intro').hidden = true;
      panel.querySelector('.feed-fallback').hidden = false;
      closeButton.hidden = false;
      closeButton.focus();
    });
    closeButton.addEventListener('click', function () { close(panel, true); });
  });
})();
