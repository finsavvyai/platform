/**
 * Luna OS - Mobile Helper Functions
 * Handles mobile menu, touch gestures, and responsive behaviors
 */

(function() {
    'use strict';

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    function init() {
        setupMobileMenu();
        setupTouchGestures();
        setupResponsiveImages();
        setupSmoothScroll();
        preventZoom();
        setupA11y();
    }

    /**
     * Mobile Menu Toggle
     */
    function setupMobileMenu() {
        // Create mobile menu toggle button if it doesn't exist
        const nav = document.querySelector('.nav');
        const navLinks = document.querySelector('.nav-links');

        if (!nav || !navLinks) return;

        let mobileToggle = document.querySelector('.mobile-menu-toggle');

        if (!mobileToggle) {
            mobileToggle = document.createElement('button');
            mobileToggle.className = 'mobile-menu-toggle';
            mobileToggle.setAttribute('aria-label', 'Toggle mobile menu');
            mobileToggle.setAttribute('aria-expanded', 'false');
            mobileToggle.innerHTML = '<span>☰</span>';

            // Insert before CTA button or at end of nav
            const ctaButton = document.querySelector('.cta-button');
            if (ctaButton) {
                nav.insertBefore(mobileToggle, ctaButton);
            } else {
                nav.appendChild(mobileToggle);
            }
        }

        // Toggle menu
        mobileToggle.addEventListener('click', function(e) {
            e.stopPropagation();
            const isOpen = navLinks.classList.contains('mobile-active');

            if (isOpen) {
                navLinks.classList.remove('mobile-active');
                mobileToggle.setAttribute('aria-expanded', 'false');
                mobileToggle.innerHTML = '<span>☰</span>';
            } else {
                navLinks.classList.add('mobile-active');
                mobileToggle.setAttribute('aria-expanded', 'true');
                mobileToggle.innerHTML = '<span>✕</span>';
            }
        });

        // Close menu when clicking outside
        document.addEventListener('click', function(e) {
            if (!nav.contains(e.target) && navLinks.classList.contains('mobile-active')) {
                navLinks.classList.remove('mobile-active');
                mobileToggle.setAttribute('aria-expanded', 'false');
                mobileToggle.innerHTML = '<span>☰</span>';
            }
        });

        // Close menu when clicking on a link
        const links = navLinks.querySelectorAll('a');
        links.forEach(link => {
            link.addEventListener('click', function() {
                if (window.innerWidth < 768) {
                    navLinks.classList.remove('mobile-active');
                    mobileToggle.setAttribute('aria-expanded', 'false');
                    mobileToggle.innerHTML = '<span>☰</span>';
                }
            });
        });

        // Handle resize
        let resizeTimer;
        window.addEventListener('resize', function() {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function() {
                if (window.innerWidth >= 768) {
                    navLinks.classList.remove('mobile-active');
                    mobileToggle.setAttribute('aria-expanded', 'false');
                    mobileToggle.innerHTML = '<span>☰</span>';
                }
            }, 250);
        });
    }

    /**
     * Touch Gestures (Swipe to close menu, etc.)
     */
    function setupTouchGestures() {
        let touchStartX = 0;
        let touchStartY = 0;
        let touchEndX = 0;
        let touchEndY = 0;

        const navLinks = document.querySelector('.nav-links');
        if (!navLinks) return;

        navLinks.addEventListener('touchstart', function(e) {
            touchStartX = e.changedTouches[0].screenX;
            touchStartY = e.changedTouches[0].screenY;
        }, { passive: true });

        navLinks.addEventListener('touchend', function(e) {
            touchEndX = e.changedTouches[0].screenX;
            touchEndY = e.changedTouches[0].screenY;
            handleSwipe();
        }, { passive: true });

        function handleSwipe() {
            const swipeThreshold = 50;
            const diffX = touchEndX - touchStartX;
            const diffY = touchEndY - touchStartY;

            // Swipe up to close menu on mobile
            if (Math.abs(diffY) > Math.abs(diffX) && Math.abs(diffY) > swipeThreshold) {
                if (diffY < 0 && window.innerWidth < 768) {
                    // Swipe up
                    navLinks.classList.remove('mobile-active');
                    const toggle = document.querySelector('.mobile-menu-toggle');
                    if (toggle) {
                        toggle.setAttribute('aria-expanded', 'false');
                        toggle.innerHTML = '<span>☰</span>';
                    }
                }
            }
        }
    }

    /**
     * Responsive Images (lazy loading)
     */
    function setupResponsiveImages() {
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        if (img.dataset.src) {
                            img.src = img.dataset.src;
                            img.removeAttribute('data-src');
                        }
                        observer.unobserve(img);
                    }
                });
            });

            document.querySelectorAll('img[data-src]').forEach(img => {
                imageObserver.observe(img);
            });
        }
    }

    /**
     * Smooth Scroll
     */
    function setupSmoothScroll() {
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function(e) {
                const href = this.getAttribute('href');
                if (href === '#' || href === '#!') return;

                const target = document.querySelector(href);
                if (target) {
                    e.preventDefault();
                    const headerHeight = document.querySelector('.header')?.offsetHeight || 0;
                    const targetPosition = target.offsetTop - headerHeight;

                    window.scrollTo({
                        top: targetPosition,
                        behavior: 'smooth'
                    });

                    // Update URL without page jump
                    if (history.pushState) {
                        history.pushState(null, null, href);
                    }
                }
            });
        });
    }

    /**
     * Prevent Double-Tap Zoom on iOS
     */
    function preventZoom() {
        let lastTouchEnd = 0;

        document.addEventListener('touchend', function(e) {
            const now = Date.now();
            if (now - lastTouchEnd <= 300) {
                e.preventDefault();
            }
            lastTouchEnd = now;
        }, { passive: false });
    }

    /**
     * Accessibility Improvements
     */
    function setupA11y() {
        // Add skip to main content link
        if (!document.querySelector('.skip-to-main')) {
            const skipLink = document.createElement('a');
            skipLink.href = '#main';
            skipLink.className = 'skip-to-main';
            skipLink.textContent = 'Skip to main content';
            skipLink.style.cssText = `
                position: absolute;
                left: -9999px;
                z-index: 999;
                padding: 1em;
                background-color: #000;
                color: white;
                opacity: 0;
            `;

            skipLink.addEventListener('focus', function() {
                this.style.left = '0';
                this.style.opacity = '1';
            });

            skipLink.addEventListener('blur', function() {
                this.style.left = '-9999px';
                this.style.opacity = '0';
            });

            document.body.insertBefore(skipLink, document.body.firstChild);
        }

        // Add focus visible polyfill for better keyboard navigation
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Tab') {
                document.body.classList.add('using-keyboard');
            }
        });

        document.addEventListener('mousedown', function() {
            document.body.classList.remove('using-keyboard');
        });

        // Add aria-labels to buttons without text
        document.querySelectorAll('button:not([aria-label])').forEach(btn => {
            const text = btn.textContent.trim();
            if (!text || text.length < 2) {
                const icon = btn.querySelector('i, svg, span[class*="icon"]');
                if (icon) {
                    btn.setAttribute('aria-label', 'Button');
                }
            }
        });
    }

    /**
     * Viewport Height Fix for Mobile Browsers
     */
    function setViewportHeight() {
        // Fix for mobile browsers where 100vh includes address bar
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
    }

    setViewportHeight();
    window.addEventListener('resize', setViewportHeight);
    window.addEventListener('orientationchange', setViewportHeight);

    /**
     * Performance Monitoring
     */
    /* Performance observer removed - no console.log in production */

    /**
     * Detect if running as PWA
     */
    if (window.matchMedia('(display-mode: standalone)').matches) {
        document.body.classList.add('pwa-mode');
    }

    /**
     * Network Status
     */
    function updateOnlineStatus() {
        if (navigator.onLine) {
            document.body.classList.remove('offline');
        } else {
            document.body.classList.add('offline');
            showToast('You are offline', 'warning');
        }
    }

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    /**
     * Toast Notification Helper
     */
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            z-index: 9999;
            animation: slideUp 0.3s ease;
        `;

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideDown 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // Export helper functions
    window.LunaMobile = {
        showToast,
        setViewportHeight
    };

})();
