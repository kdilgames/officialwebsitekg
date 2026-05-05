document.addEventListener("DOMContentLoaded", () => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isMobile = window.matchMedia("(max-width: 768px)").matches;

    initNavbar();
    initMobileMenu();

    if (prefersReducedMotion) {
        document.querySelectorAll(".kdil-reveal").forEach((element) => {
            element.classList.add("kdil-visible");
        });
        return;
    }

    initCursorGlow();
    initParticles();
    initRevealAnimations();
    initCardTilt();

    function initNavbar() {
        const navbar = document.getElementById("navbar");
        if (!navbar) return;

        const updateNavbar = () => {
            if (window.scrollY > 30) {
                navbar.classList.add("glass-nav");
            } else {
                navbar.classList.remove("glass-nav");
            }
        };

        updateNavbar();
        window.addEventListener("scroll", updateNavbar, { passive: true });
    }

    function initMobileMenu() {
        const toggle = document.getElementById("mobile-toggle");
        const close = document.getElementById("mobile-close");
        const menu = document.getElementById("mobile-menu");
        const links = document.querySelectorAll(".mobile-link");

        if (!toggle || !close || !menu) return;

        const openMenu = () => {
            menu.classList.remove("translate-x-full");
            document.body.style.overflow = "hidden";
        };

        const closeMenu = () => {
            menu.classList.add("translate-x-full");
            document.body.style.overflow = "";
        };

        toggle.addEventListener("click", openMenu);
        close.addEventListener("click", closeMenu);
        links.forEach((link) => link.addEventListener("click", closeMenu));
    }

    function initCursorGlow() {
        if (isMobile) return;

        const glow = document.getElementById("cursor-glow");
        if (!glow) return;

        let mouseX = window.innerWidth / 2;
        let mouseY = window.innerHeight / 2;
        let glowX = mouseX;
        let glowY = mouseY;

        window.addEventListener("mousemove", (event) => {
            mouseX = event.clientX;
            mouseY = event.clientY;
        }, { passive: true });

        function animateGlow() {
            glowX += (mouseX - glowX) * 0.08;
            glowY += (mouseY - glowY) * 0.08;

            glow.style.transform = `translate3d(${glowX - 230}px, ${glowY - 230}px, 0)`;
            requestAnimationFrame(animateGlow);
        }

        animateGlow();
    }

    function initParticles() {
        const layer = document.getElementById("hero-particles");
        if (!layer) return;

        const particleCount = isMobile ? 22 : 58;

        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement("span");
            particle.className = "kdil-particle";

            particle.style.left = `${Math.random() * 100}%`;
            particle.style.top = `${Math.random() * 100}%`;
            particle.style.opacity = `${0.25 + Math.random() * 0.55}`;
            particle.style.setProperty("--duration", `${8 + Math.random() * 12}s`);
            particle.style.setProperty("--move-x", `${-70 + Math.random() * 140}px`);
            particle.style.setProperty("--move-y", `${-90 + Math.random() * 180}px`);
            particle.style.animationDelay = `${Math.random() * 8}s`;

            layer.appendChild(particle);
        }
    }

    function initRevealAnimations() {
        const revealElements = document.querySelectorAll(".kdil-reveal");

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("kdil-visible");
                }
            });
        }, {
            threshold: 0.12,
            rootMargin: "0px 0px -70px 0px"
        });

        revealElements.forEach((element) => observer.observe(element));
    }

    function initCardTilt() {
        if (isMobile) return;

        const cards = document.querySelectorAll(".game-card");

        cards.forEach((card) => {
            card.addEventListener("mousemove", (event) => {
                const rect = card.getBoundingClientRect();
                const x = event.clientX - rect.left;
                const y = event.clientY - rect.top;

                const centerX = rect.width / 2;
                const centerY = rect.height / 2;

                const rotateX = ((y - centerY) / centerY) * -2.5;
                const rotateY = ((x - centerX) / centerX) * 2.5;

                card.style.transform = `perspective(1200px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
            });

            card.addEventListener("mouseleave", () => {
                card.style.transform = "";
            });
        });
    }
});
