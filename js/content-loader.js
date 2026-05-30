/**
 * HELIDA Tools - Content Loader
 * Loads content from data/content.json and localStorage overrides
 * Dynamically populates page sections
 */
(function() {
    'use strict';

    var CONTENT_KEY = 'helida_content';
    var currentLang = 'en';
    var content = null;
    var contentReady = false;

    // Get translated text from content object
    function ct(obj, lang) {
        if (!obj) return '';
        if (typeof obj === 'string') return obj;
        return obj[lang] || obj['en'] || obj['zh'] || '';
    }

    // Deep merge objects
    function deepMerge(target, source) {
        var result = JSON.parse(JSON.stringify(target));
        for (var key in source) {
            if (source.hasOwnProperty(key)) {
                if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                    result[key] = deepMerge(result[key] || {}, source[key]);
                } else {
                    result[key] = source[key];
                }
            }
        }
        return result;
    }

    // Load and apply all content
    function loadAndApply() {
        var localContent = null;
        try {
            var saved = localStorage.getItem(CONTENT_KEY);
            if (saved) { localContent = JSON.parse(saved); }
        } catch(e) {}

        // Try fetch content.json
        var xhr = new XMLHttpRequest();
        xhr.open('GET', 'data/content.json', true);
        xhr.onload = function() {
            if (xhr.status >= 200 && xhr.status < 400) {
                try { content = JSON.parse(xhr.responseText); } catch(e) {}
            }

            // Version check: if server has newer version, discard stale localStorage
            if (content && localContent && content.version && (!localContent.version || localContent.version < content.version)) {
                localContent = null;
            }
            // Merge localStorage overrides only if versions match
            if (localContent && content && localContent.version === content.version) {
                content = deepMerge(content, localContent);
            } else if (localContent && !content) {
                content = localContent;
            }
            if (content) {
                applyContent();
                contentReady = true;
                // Notify main.js that content is ready
                window.dispatchEvent(new Event('contentReady'));
            }
        };
        xhr.onerror = function() {
            if (localContent) {
                content = localContent;
                applyContent();
                contentReady = true;
                window.dispatchEvent(new Event('contentReady'));
            }
        };
        xhr.send();
    }

    function applyContent() {
        if (!content) return;
        var lang = currentLang;
        applyBanner(lang);
        applyAbout(lang);
        applyProducts(lang);
        applyCertificates(lang);
        applyDownload(lang);
        applyContact(lang);
        applyFooter(lang);
    }

    // ===== BANNER =====
    function applyBanner(lang) {
        if (!content.banner || !content.banner.slides || content.banner.slides.length === 0) return;
        var slides = content.banner.slides;
        var slider = document.getElementById('heroSlider');
        if (!slider) return;

        var html = '';
        slides.forEach(function(slide, i) {
            html += '<div class="slide' + (i === 0 ? ' active' : '') + '">' +
                '<div class="slide-bg" style="background: linear-gradient(135deg, rgba(10,22,40,0.7) 0%, rgba(26,58,92,0.6) 50%, rgba(13,33,55,0.7) 100%), url(\'' + slide.image + '\') center/cover no-repeat;"></div>' +
                '<div class="slide-particles"></div>' +
                '<div class="slide-content container">' +
                    '<div class="slide-text">' +
                        '<span class="slide-tag">' + ct(slide.tag, lang) + '</span>' +
                        '<h1>' + ct(slide.title, lang) + '</h1>' +
                        '<p>' + ct(slide.desc, lang) + '</p>' +
                        '<div class="slide-btns">' +
                            '<a href="' + slide.btn1Link + '" class="btn btn-primary">' + ct(slide.btn1Text, lang) + '</a>' +
                            '<a href="' + slide.btn2Link + '" class="btn btn-outline">' + ct(slide.btn2Text, lang) + '</a>' +
                        '</div>' +
                    '</div>' +
                    '<div class="slide-image">' +
                        '<div class="hero-product-showcase">' +
                            '<div class="hero-blade hero-blade-1"><i class="fas fa-circle-notch"></i></div>' +
                            '<div class="hero-blade hero-blade-2"><i class="fas fa-circle"></i></div>' +
                            '<div class="hero-blade hero-blade-3"><i class="fas fa-dharmachakra"></i></div>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
            '</div>';
        });
        slider.innerHTML = html +
            '<button class="slider-arrow slider-prev" onclick="changeSlide(-1)" aria-label="Previous">&#10094;</button>' +
            '<button class="slider-arrow slider-next" onclick="changeSlide(1)" aria-label="Next">&#10095;</button>' +
            '<div class="slider-dots" id="sliderDots"></div>';

        // Reset slider state
        if (window.currentSlide !== undefined) window.currentSlide = 0;
    }

    // ===== ABOUT =====
    function applyAbout(lang) {
        if (!content.about) return;
        var about = content.about;

        // Update about image
        var aboutImg = document.querySelector('.about-img-placeholder');
        if (aboutImg && about.image) {
            aboutImg.style.backgroundImage = 'url(\'' + about.image + '\')';
            aboutImg.style.backgroundSize = 'cover';
            aboutImg.style.backgroundPosition = 'center';
            aboutImg.style.backgroundRepeat = 'no-repeat';
        }

        // Update title
        var titleEl = document.querySelector('#about .section-title');
        if (titleEl && about.title) {
            titleEl.textContent = ct(about.title, lang);
        }

        // Update paragraph texts
        var aboutContent = document.querySelector('.about-content');
        if (aboutContent && about.texts) {
            var paras = aboutContent.querySelectorAll('p');
            about.texts.forEach(function(txt, i) {
                if (paras[i]) {
                    paras[i].textContent = ct(txt, lang);
                }
            });
        }

        // Update stats
        var statElements = document.querySelectorAll('.about-stats .stat');
        if (about.stats) {
            about.stats.forEach(function(s, i) {
                if (statElements[i]) {
                    var numEl = statElements[i].querySelector('.stat-num');
                    var labelEl = statElements[i].querySelector('.stat-label');
                    if (numEl) numEl.textContent = s.num;
                    if (labelEl) labelEl.textContent = ct(s.label, lang);
                }
            });
        }
    }

    // ===== PRODUCTS =====
    function applyProducts(lang) {
        if (!content.products) return;
        var productsSection = document.getElementById('products');
        if (!productsSection) return;
        var container = productsSection.querySelector('.container');
        if (!container) return;

        // Remove existing product categories (keep section-header)
        var existingCategories = container.querySelectorAll('.product-category');
        existingCategories.forEach(function(cat) { cat.remove(); });

        // Build and insert new categories
        content.products.forEach(function(cat) {
            var catDiv = document.createElement('div');
            catDiv.className = 'product-category';

            // Build items HTML
            var itemsHtml = '';
            cat.items.forEach(function(item) {
                var titleText = ct(item.title, lang);
                var sizeText = ct(item.size, lang);
                itemsHtml += '<div class="product-card product-card-sub" onclick="productInquiry(\'' +
                    item.image.replace(/'/g, "\\'") + '\',\'' +
                    titleText.replace(/'/g, "\\'") + '\',\'' +
                    sizeText.replace(/'/g, "\\'") + '\')">' +
                    '<div class="product-img"><img src="' + item.image + '" alt="' + titleText + '" loading="lazy"></div>' +
                    '<div class="product-info">' +
                        '<h4>' + titleText + '</h4>' +
                        '<span class="product-tag">' + sizeText + '</span>' +
                    '</div>' +
                '</div>';
            });
            // Add "More Models" card
            itemsHtml += '<div class="product-card product-card-sub product-card-add">' +
                '<div class="product-img"><i class="fas fa-plus-circle"></i></div>' +
                '<div class="product-info">' +
                    '<h4 data-i18n="prodAddMore">+ More Models</h4>' +
                    '<span class="product-tag" data-i18n="prodAddMoreDesc">More specifications available</span>' +
                '</div>' +
            '</div>';

            catDiv.innerHTML = '<div class="product-cat-header">' +
                '<div class="product-cat-icon"><i class="fas ' + (cat.icon || 'fa-cube') + '"></i></div>' +
                '<div class="product-cat-info">' +
                    '<h3>' + ct(cat.title, lang) + '</h3>' +
                    '<p>' + ct(cat.desc, lang) + '</p>' +
                '</div>' +
            '</div>' +
            '<div class="product-sub-grid">' + itemsHtml + '</div>';

            container.appendChild(catDiv);
        });
    }

    // ===== CERTIFICATES =====
    function applyCertificates(lang) {
        if (!content.certificates) return;
        var certs = content.certificates;

        var titleEl = document.querySelector('#certificates .section-title');
        if (titleEl && certs.title) titleEl.textContent = ct(certs.title, lang);

        var descEl = document.querySelector('#certificates .section-desc');
        if (descEl && certs.desc) descEl.textContent = ct(certs.desc, lang);

        var grid = document.querySelector('.cert-grid');
        if (grid && certs.items) {
            var html = '';
            certs.items.forEach(function(c) {
                html += '<div class="cert-card">' +
                    '<div class="cert-icon"><i class="fas ' + (c.icon || 'fa-certificate') + '"></i></div>' +
                    '<h3>' + (c.title || '') + '</h3>' +
                    '<p>' + ct(c.desc, lang) + '</p>' +
                '</div>';
            });
            grid.innerHTML = html;
        }
    }

    // ===== DOWNLOAD =====
    function applyDownload(lang) {
        if (!content.download) return;
        var dl = content.download;

        var titleEl = document.querySelector('#download h2');
        if (titleEl && dl.title) titleEl.textContent = ct(dl.title, lang);

        var textEl = document.querySelector('#download p');
        if (textEl && dl.text) textEl.textContent = ct(dl.text, lang);

        var btnSpan = document.querySelector('#download .btn span');
        if (btnSpan && dl.btnText) btnSpan.textContent = ct(dl.btnText, lang);
    }

    // ===== CONTACT =====
    function applyContact(lang) {
        if (!content.contact) return;
        var c = content.contact;

        var titleEl = document.querySelector('#contact .section-title');
        if (titleEl && c.title) titleEl.textContent = ct(c.title, lang);

        // Contact info cards - find by icon
        var infoCards = document.querySelectorAll('#contact .contact-info-card');
        infoCards.forEach(function(card) {
            var icon = card.querySelector('.contact-icon-circle i');
            var p = card.querySelector('p');
            if (!icon || !p) return;

            if (icon.classList.contains('fa-map-marker-alt') && c.address) {
                p.textContent = ct(c.address, lang);
            } else if (icon.classList.contains('fa-phone') && c.phone) {
                p.textContent = c.phone;
            } else if (icon.classList.contains('fa-envelope') && c.email) {
                p.textContent = c.email;
            } else if (icon.classList.contains('fa-whatsapp') && c.whatsapp) {
                p.textContent = c.whatsapp;
            }
        });

        // Update top bar contact info
        if (c.email) {
            var topEmail = document.querySelector('.top-bar-left span:first-child');
            if (topEmail) topEmail.innerHTML = '<i class="fas fa-envelope"></i> ' + c.email;
        }

        // Update social links
        if (c.social) {
            var topSocial = document.querySelectorAll('.social-top a');
            if (topSocial.length >= 5) {
                if (c.social.facebook) topSocial[0].href = c.social.facebook;
                if (c.social.twitter) topSocial[1].href = c.social.twitter;
                if (c.social.instagram) topSocial[2].href = c.social.instagram;
                if (c.social.youtube) topSocial[3].href = c.social.youtube;
                if (c.social.linkedin) topSocial[4].href = c.social.linkedin;
            }
            var footerSocial = document.querySelectorAll('.footer-social a');
            if (footerSocial.length >= 5) {
                if (c.social.facebook) footerSocial[0].href = c.social.facebook;
                if (c.social.twitter) footerSocial[1].href = c.social.twitter;
                if (c.social.instagram) footerSocial[2].href = c.social.instagram;
                if (c.social.youtube) footerSocial[3].href = c.social.youtube;
                if (c.social.linkedin) footerSocial[4].href = c.social.linkedin;
            }
        }
    }

    // ===== FOOTER =====
    function applyFooter(lang) {
        if (!content.footer) return;

        var aboutEl = document.querySelector('.footer-about p');
        if (aboutEl && content.footer.about) {
            aboutEl.textContent = ct(content.footer.about, lang);
        }

        var nlTextEl = document.querySelector('.footer-col:nth-child(4) > p');
        if (nlTextEl && content.footer.newsletterText) {
            nlTextEl.textContent = ct(content.footer.newsletterText, lang);
        }
    }

    // ===== EVENT LISTENERS =====

    // Language change
    window.addEventListener('contentLangChanged', function(e) {
        if (e.detail && e.detail.lang) {
            currentLang = e.detail.lang;
            if (content) applyContent();
        }
    });

    // Initialize on DOM ready
    document.addEventListener('DOMContentLoaded', function() {
        var saved = localStorage.getItem('yishui-lang');
        currentLang = saved || 'en';
        loadAndApply();
    });

    // Export for external use
    window.refreshContent = function(lang) {
        if (lang) currentLang = lang;
        loadAndApply();
    };

    window.isContentReady = function() {
        return contentReady;
    };

})();
