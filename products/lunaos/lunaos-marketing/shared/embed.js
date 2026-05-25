/**
 * LunaOS Shared Nav/Footer Embed Script
 * Usage: <script src="https://lunaos.ai/shared/embed.js"></script>
 */
(function () {
  var BASE = 'https://lunaos.ai/shared';

  function inject(url, position) {
    fetch(url)
      .then(function (res) { return res.text(); })
      .then(function (html) {
        var container = document.createElement('div');
        container.innerHTML = html;
        if (position === 'prepend') {
          document.body.insertBefore(container, document.body.firstChild);
        } else {
          document.body.appendChild(container);
        }
        // Execute inline <style> tags
        container.querySelectorAll('style').forEach(function (s) {
          var style = document.createElement('style');
          style.textContent = s.textContent;
          document.head.appendChild(style);
          s.remove();
        });
      })
      .catch(function (err) {
        console.warn('[LunaOS] Failed to load ' + url, err);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load);
  } else {
    load();
  }

  function load() {
    inject(BASE + '/shared-nav.html', 'prepend');
    inject(BASE + '/shared-footer.html', 'append');
  }
})();
