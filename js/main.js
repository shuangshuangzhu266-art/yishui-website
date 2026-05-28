/**
 * YISHUI Tools Website - Main JavaScript
 */

// ===== Hero Slider =====
let currentSlide = 0;
let slideInterval;
const totalSlides = document.querySelectorAll('.slide').length;

function initSlider() {
    if (totalSlides <= 1) return;
    // Create dots
    const dotsContainer = document.getElementById('sliderDots');
    for (let i = 0; i < totalSlides; i++) {
        const dot = document.createElement('button');
        dot.className = 'slider-dot' + (i === 0 ? ' active' : '');
        dot.setAttribute('aria-label', 'Slide ' + (i + 1));
        dot.onclick = function() { goToSlide(i); };
        dotsContainer.appendChild(dot);
    }
    startAutoSlide();
}

function goToSlide(index) {
    const slides = document.querySelectorAll('.slide');
    const dots = document.querySelectorAll('.slider-dot');
    slides[currentSlide].classList.remove('active');
    dots[currentSlide].classList.remove('active');
    currentSlide = index;
    if (currentSlide >= totalSlides) currentSlide = 0;
    if (currentSlide < 0) currentSlide = totalSlides - 1;
    slides[currentSlide].classList.add('active');
    dots[currentSlide].classList.add('active');
    resetAutoSlide();
}

function changeSlide(dir) {
    goToSlide(currentSlide + dir);
}

function startAutoSlide() {
    slideInterval = setInterval(function() { goToSlide(currentSlide + 1); }, 5000);
}

function resetAutoSlide() {
    clearInterval(slideInterval);
    startAutoSlide();
}

// ===== Language Switcher =====
function toggleLangMenu() {
    document.getElementById('langMenu').classList.toggle('show');
}

// Close lang menu when clicking outside
document.addEventListener('click', function(e) {
    const menu = document.getElementById('langMenu');
    const btn = document.getElementById('langCurrent');
    if (menu && btn && !btn.contains(e.target) && !menu.contains(e.target)) {
        menu.classList.remove('show');
    }
});

// ===== Mobile Menu =====
function toggleMobileMenu() {
    document.getElementById('nav').classList.toggle('show');
}

// Close mobile menu on link click
document.querySelectorAll('.nav-link').forEach(function(link) {
    link.addEventListener('click', function() {
        document.getElementById('nav').classList.remove('show');
    });
});

// ===== Search Toggle =====
function toggleSearch() {
    document.getElementById('searchOverlay').classList.toggle('show');
    if (document.getElementById('searchOverlay').classList.contains('show')) {
        setTimeout(function() { document.getElementById('searchInput').focus(); }, 100);
    }
}

// ===== Chat Widget =====
function toggleChat() {
    document.getElementById('chatBox').classList.toggle('show');
}

// ===== Back to Top =====
function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.addEventListener('scroll', function() {
    var btn = document.getElementById('backToTop');
    if (window.scrollY > 500) {
        btn.classList.add('visible');
    } else {
        btn.classList.remove('visible');
    }

    // Header shadow on scroll
    var header = document.getElementById('header');
    if (window.scrollY > 10) {
        header.classList.add('scrolled');
    } else {
        header.classList.remove('scrolled');
    }

    // Active nav link based on scroll position
    updateActiveNav();
});

function updateActiveNav() {
    var sections = document.querySelectorAll('.section, .hero');
    var navLinks = document.querySelectorAll('.nav-link');
    var scrollPos = window.scrollY + 150;

    sections.forEach(function(section) {
        var top = section.offsetTop;
        var bottom = top + section.offsetHeight;
        var id = section.getAttribute('id');

        if (scrollPos >= top && scrollPos < bottom && id) {
            navLinks.forEach(function(link) {
                link.classList.remove('active');
                if (link.getAttribute('href') === '#' + id) {
                    link.classList.add('active');
                }
            });
        }
    });
}

// ===== Contact Form =====
function handleContactSubmit(event) {
    event.preventDefault();
    var form = document.getElementById('contactForm');
    var success = document.getElementById('formSuccess');

    // Simulate form submission
    form.style.display = 'none';
    success.style.display = 'block';

    // Reset after 5 seconds
    setTimeout(function() {
        form.style.display = '';
        success.style.display = 'none';
        form.reset();
    }, 5000);
}

// ===== Newsletter Form =====
function handleNewsletterSubmit(event) {
    event.preventDefault();
    var input = event.target.querySelector('input');
    var btn = event.target.querySelector('button');
    var originalHTML = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-check"></i>';
    btn.style.background = '#27ae60';
    input.value = '';
    setTimeout(function() {
        btn.innerHTML = originalHTML;
        btn.style.background = '';
    }, 3000);
}

// ===== Smooth scroll for anchor links =====
document.querySelectorAll('a[href^="#"]').forEach(function(anchor) {
    anchor.addEventListener('click', function(e) {
        var targetId = this.getAttribute('href');
        if (targetId === '#') return;
        var target = document.querySelector(targetId);
        if (target) {
            e.preventDefault();
            target.scrollIntoView({ behavior: 'smooth' });
        }
    });
});

// ===== Animate elements on scroll =====
var observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
            observer.unobserve(entry.target);
        }
    });
}, observerOptions);

// Observe product cards, cert cards, news cards with animation
document.addEventListener('DOMContentLoaded', function() {
    var animElements = document.querySelectorAll('.product-card, .cert-card, .news-card, .stat');
    animElements.forEach(function(el) {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
});

// ===== Initialize =====
document.addEventListener('DOMContentLoaded', function() {
    initSlider();
    updateActiveNav();
});

// ===== Keyboard navigation =====
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        document.getElementById('searchOverlay').classList.remove('show');
        document.getElementById('langMenu').classList.remove('show');
        document.getElementById('chatBox').classList.remove('show');
        document.getElementById('nav').classList.remove('show');
    }
    if (e.key === 'ArrowLeft') changeSlide(-1);
    if (e.key === 'ArrowRight') changeSlide(1);
});
