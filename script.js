(function() {
  'use strict';

  /* ---------- NAV TOGGLE ---------- */
  const toggle = document.getElementById('nav-toggle');
  const navMenu = document.getElementById('nav-menu');
  if (toggle && navMenu) {
    toggle.addEventListener('click', function() {
      const expanded = toggle.getAttribute('aria-expanded') === 'true' ? false : true;
      navMenu.classList.toggle('nav-open');
      toggle.setAttribute('aria-expanded', expanded);
    });
    document.querySelectorAll('.nav-link').forEach(function(link) {
      link.addEventListener('click', function() {
        navMenu.classList.remove('nav-open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ---------- ACTIVE NAV LINK ---------- */
  function updateActiveNav() {
    const links = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('.section');
    var current = '';
    sections.forEach(function(section) {
      var top = section.offsetTop - 150;
      var bottom = top + section.offsetHeight;
      if (window.scrollY >= top && window.scrollY < bottom) {
        current = section.id;
      }
    });
    links.forEach(function(link) {
      link.classList.remove('active');
      if (link.getAttribute('href') === '#' + current) {
        link.classList.add('active');
      }
    });
  }

  /* ---------- SMOOTH SCROLL (nav only) ---------- */
  document.addEventListener('click', function(e) {
    var target = e.target.closest('.nav-link, .hero-actions a[href^="#"], .zoom-link');
    if (!target) return;
    if (target.classList.contains('zoom-link')) return;
    var href = target.getAttribute('href');
    if (!href || href.charAt(0) !== '#') return;
    e.preventDefault();
    var el = document.querySelector(href);
    if (el) {
      var header = document.querySelector('.site-header');
      var offset = header ? header.offsetHeight : 0;
      var pos = el.getBoundingClientRect().top + window.pageYOffset - offset;
      window.scrollTo({ top: pos, behavior: 'smooth' });
    }
  });

  /* ---------- HEADER SCROLL SHADOW ---------- */
  function handleHeaderScroll() {
    var header = document.querySelector('.site-header');
    if (!header) return;
    if (window.scrollY > 10) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  }

  /* ---------- SCROLL TO TOP ---------- */
  function handleScrollTopVisibility() {
    var btn = document.querySelector('.scroll-top');
    if (!btn) return;
    if (window.scrollY > 400) {
      btn.classList.add('visible');
    } else {
      btn.classList.remove('visible');
    }
  }

  document.addEventListener('click', function(e) {
    var btn = e.target.closest('.scroll-top');
    if (!btn) return;
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  window.addEventListener('scroll', function() {
    updateActiveNav();
    handleHeaderScroll();
    handleScrollTopVisibility();
  }, { passive: true });

  /* ---------- SCHEDULE ---------- */
  var scheduleData = [
    { day: 'Friday', hour: 18, minute: 0, label: '6:00–7:00 PM ET', timezoneName: 'America/New_York' }
  ];

  function initSchedule() {
    var list = document.getElementById('schedule-list');
    if (!list) return;
    var now = new Date();
    var DAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
    var localDateFmt = { month: 'long', day: 'numeric' };
    var localTimeFmt = { hour: 'numeric', minute: '2-digit' };

    scheduleData.forEach(function(item) {
      var dayIndex = DAYS.indexOf(item.day.toLowerCase());
      var next = new Date(now);
      next.setDate(next.getDate() + ((dayIndex - next.getDay() + 7) % 7));
      if (next <= now) next.setDate(next.getDate() + 7);

      for (var i = 0; i < 4; i++) {
        var date = new Date(next);
        date.setDate(date.getDate() + 7 * i);

        // get date parts in ET
        var etDateStr = date.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
        var p = etDateStr.split('-');
        var ey = parseInt(p[0]), em = parseInt(p[1]) - 1, ed = parseInt(p[2]);

        // determine ET offset for that date
        var noonUTC = Date.UTC(ey, em, ed, 12, 0, 0);
        var noonHr = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false }).format(new Date(noonUTC));
        var offset = 12 - parseInt(noonHr);

        // create Dates for start and end in local time
        var startLocal = new Date(Date.UTC(ey, em, ed, item.hour + offset, item.minute, 0));
        var endLocal = new Date(Date.UTC(ey, em, ed, item.hour + 1 + offset, item.minute, 0));

        var dateStr = startLocal.toLocaleDateString('en-US', localDateFmt);
        var startTime = startLocal.toLocaleTimeString('en-US', localTimeFmt);
        var endTime = endLocal.toLocaleTimeString('en-US', localTimeFmt);

        var li = document.createElement('li');
        li.className = 'schedule-item';
        li.innerHTML = '<span class="schedule-date">' + dateStr + ' ' + startTime + '&#8211;' + endTime + '</span>';
        list.appendChild(li);
      }
    });
  }

  /* ---------- COUNTDOWN ---------- */
  function initCountdown() {
    var el = {
      days: document.getElementById('countdown-days'),
      hours: document.getElementById('countdown-hours'),
      minutes: document.getElementById('countdown-minutes'),
      seconds: document.getElementById('countdown-seconds')
    };
    var nextStudy = getNextStudyTime();
    function getNextStudyTime() {
      var now = new Date();
      var target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0, 0);
      var dayIndex = 6; // Saturday
      while (target.getDay() !== dayIndex) {
        target.setDate(target.getDate() + 1);
      }
      if (target <= now) {
        target.setDate(target.getDate() + 7);
      }
      return target.getTime();
    }
    function tick() {
      var now = Date.now();
      var diff = nextStudy - now;
      if (diff <= 0) {
        nextStudy = getNextStudyTime();
        diff = nextStudy - now;
      }
      var d = Math.floor(diff / 86400000);
      var h = Math.floor((diff % 86400000) / 3600000);
      var m = Math.floor((diff % 3600000) / 60000);
      var s = Math.floor((diff % 60000) / 1000);
      if (el.days) el.days.textContent = String(d).padStart(2, '0');
      if (el.hours) el.hours.textContent = String(h).padStart(2, '0');
      if (el.minutes) el.minutes.textContent = String(m).padStart(2, '0');
      if (el.seconds) el.seconds.textContent = String(s).padStart(2, '0');
    }
    tick();
    setInterval(tick, 1000);
  }

  /* ---------- ZOOM ---------- */
  function initZoom() {
    const link = document.querySelector('.zoom-link');
    const placeholder = document.getElementById('zoom-placeholder');
    const uploadInput = document.getElementById('zoom-image-upload');
    if (!link || !placeholder || !uploadInput) return;
    const savedLink = localStorage.getItem('efbs_zoom_link');
    if (savedLink) link.href = savedLink;
    const savedImg = localStorage.getItem('efbs_zoom_image');
    if (savedImg) {
      placeholder.style.backgroundImage = 'url(' + savedImg + ')';
      placeholder.style.backgroundSize = 'cover';
      placeholder.style.backgroundPosition = 'center';
      placeholder.classList.add('has-image');
    }
    link.addEventListener('click', function(e) {
      if (!link.href || link.href === '#' || link.href === window.location.href) {
        e.preventDefault();
        const url = prompt('Paste your Zoom meeting link:');
        if (url && url.trim()) {
          localStorage.setItem('efbs_zoom_link', url.trim());
          link.href = url.trim();
        }
      }
    });
    placeholder.addEventListener('click', function() { uploadInput.click(); });
    uploadInput.addEventListener('change', function() {
      const file = uploadInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function(e) {
        const dataUrl = e.target.result;
        localStorage.setItem('efbs_zoom_image', dataUrl);
        placeholder.style.backgroundImage = 'url(' + dataUrl + ')';
        placeholder.style.backgroundSize = 'cover';
        placeholder.style.backgroundPosition = 'center';
        placeholder.classList.add('has-image');
      };
      reader.readAsDataURL(file);
    });
  }

  /* ---------- INIT ---------- */
  function init() {
    try { initSchedule(); } catch(e) { console.error('initSchedule:', e); }
    try { initCountdown(); } catch(e) { console.error('initCountdown:', e); }
    try { initZoom(); } catch(e) { console.error('initZoom:', e); }
    try { initSurvey(); } catch(e) { console.error('initSurvey:', e); }
    try { addAnimations(); } catch(e) { console.error('addAnimations:', e); }
    updateActiveNav();
    handleHeaderScroll();
    handleScrollTopVisibility();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // standalone survey init as fallback
  if (!window._surveyInited && document.getElementById('survey-overlay')) {
    try { initSurvey(); } catch(e) { console.error('standalone survey:', e); }
  }

  /* ---------- ANIMATION OBSERVER ---------- */
  function addAnimations() {
    if (window.IntersectionObserver) {
      var items = document.querySelectorAll('.resource-card, .game-picker-btn, .live-card, .about-card');
      items.forEach(function(el) { el.style.opacity = '0'; el.style.transform = 'translateY(20px)'; });
      var observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting) {
            entry.target.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.1 });
      items.forEach(function(el) { observer.observe(el); });
    } else {
      document.querySelectorAll('.resource-card, .game-picker-btn, .live-card, .about-card').forEach(function(el) {
        el.style.opacity = '1';
        el.style.transform = 'none';
      });
    }
  }

  /* ---------- SURVEY ---------- */
  function initSurvey() {
    if (window._surveyInited) return;
    window._surveyInited = true;
    var overlay = document.getElementById('survey-overlay');
    var closeBtn = document.getElementById('survey-close');
    var form = document.getElementById('survey-form');
    var ratingInput = document.getElementById('survey-rating');
    var improveGroup = document.getElementById('survey-improve-group');
    var starContainer = document.getElementById('star-rating');
    var thanks = document.getElementById('survey-thanks');
    if (!overlay || !form || !closeBtn || !starContainer) return;

    // build stars
    try {
      for (var i = 10; i >= 1; i--) {
        var star = document.createElement('span');
        star.className = 'star';
        star.dataset.value = i;
        star.textContent = '\u2605';
        star.addEventListener('click', function() {
          var val = parseInt(this.dataset.value);
          ratingInput.value = val;
          document.querySelectorAll('.star-rating .star').forEach(function(s) {
            s.classList.toggle('active', parseInt(s.dataset.value) <= val);
          });
          improveGroup.classList.toggle('hidden', val > 5);
        });
        starContainer.appendChild(star);
      }
    } catch(e) { console.error('Survey star error:', e); }

    function showSurvey() {
      overlay.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
    function hideSurvey() {
      overlay.classList.remove('active');
      document.body.style.overflow = '';
    }

    closeBtn.addEventListener('click', function() { localStorage.setItem('efbs_survey_time', Date.now()); hideSurvey(); });
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) { localStorage.setItem('efbs_survey_time', Date.now()); hideSurvey(); }
    });

    var last = localStorage.getItem('efbs_survey_time');
    if (!last || Date.now() - parseInt(last) >= 7200000) {
      setTimeout(showSurvey, 5000);
    }

    form.addEventListener('submit', function(e) {
      e.preventDefault();
      var email = document.getElementById('survey-email').value.trim();
      if (!email) return;
      var rating = ratingInput.value;
      var improve = document.getElementById('survey-improve').value.trim();
      var suggestions = document.getElementById('survey-suggestions').value.trim();

      var body = 'Feedback Survey\n\nEmail: ' + email + '\nRating: ' + rating + '/10';
      if (improve) body += '\nWhat can we do better?: ' + improve;
      if (suggestions) body += '\nSuggestions: ' + suggestions;

      localStorage.setItem('efbs_survey_time', Date.now());
      form.classList.add('hidden');
      thanks.classList.remove('hidden');

      window.location.href = 'mailto:efbiblestudy@gmail.com?subject=Website Feedback Survey&body=' + encodeURIComponent(body);
    });
  }

})();
