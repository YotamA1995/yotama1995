(() => {
    const viewer = document.getElementById('story-viewer');
    if (!viewer) return;

    const triggers = document.querySelectorAll('.story-card--interactive[data-story-images]');
    if (!triggers.length) return;

    const dialog = viewer.querySelector('.story-viewer__dialog');
    const closeButton = viewer.querySelector('[data-story-viewer-close]');
    const dismissBackdrop = viewer.querySelector('[data-story-viewer-dismiss]');
    const prevButton = viewer.querySelector('[data-story-viewer-prev]');
    const nextButton = viewer.querySelector('[data-story-viewer-next]');
    const imageEl = viewer.querySelector('.story-viewer__image');
    const indicator = viewer.querySelector('.story-viewer__indicator');
    const titleEl = viewer.querySelector('#story-viewer-title');
    const stage = viewer.querySelector('.story-viewer__stage');
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    let focusableElements = [];
    let activeIndex = 0;
    let pages = [];
    let activeTitle = '';
    let previousFocus = null;
    let keydownHandler = null;
    let touchStartX = null;

    const parseImages = (datasetValue = '') =>
        datasetValue
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);

    const refreshFocusable = () => {
        focusableElements = Array.from(viewer.querySelectorAll(focusableSelector)).filter(
            (el) => !el.hasAttribute('disabled') && el.offsetParent !== null
        );
    };

    const formatIndicator = (index) => {
        const pageNumber = index + 1;
        return `Page ${pageNumber} of ${pages.length}`;
    };

    const updateIndicator = () => {
        if (!indicator) return;
        const message = formatIndicator(activeIndex);
        indicator.textContent = message;
        indicator.setAttribute('aria-label', message);
    };

    const setImage = (index, { skipAnimation = false } = {}) => {
        if (!pages.length || !imageEl) return;
        const boundedIndex = (index + pages.length) % pages.length;
        activeIndex = boundedIndex;
        const nextSrc = pages[boundedIndex];
        const nextAlt = `${formatIndicator(boundedIndex)} for ${activeTitle}`;

        const applyImage = () => {
            imageEl.src = nextSrc;
            imageEl.alt = nextAlt;
        };

        updateIndicator();

        if (skipAnimation || prefersReducedMotion) {
            imageEl.classList.remove('story-viewer__image--fading');
            applyImage();
            return;
        }

        const fadeClass = 'story-viewer__image--fading';

        const handleTransitionEnd = () => {
            imageEl.removeEventListener('transitionend', handleTransitionEnd);
            applyImage();
            if (imageEl.complete) {
                requestAnimationFrame(() => imageEl.classList.remove(fadeClass));
            } else {
                imageEl.addEventListener(
                    'load',
                    () => requestAnimationFrame(() => imageEl.classList.remove(fadeClass)),
                    { once: true }
                );
            }
        };

        imageEl.classList.remove(fadeClass);
        void imageEl.offsetWidth; // force reflow so repeated transitions fire
        imageEl.addEventListener('transitionend', handleTransitionEnd, { once: true });
        requestAnimationFrame(() => imageEl.classList.add(fadeClass));
    };

    const handleKeydown = (event) => {
        switch (event.key) {
            case 'Escape':
                event.preventDefault();
                closeViewer();
                break;
            case 'ArrowRight':
                event.preventDefault();
                showNext();
                break;
            case 'ArrowLeft':
                event.preventDefault();
                showPrevious();
                break;
            case 'Tab':
                trapFocus(event);
                break;
            default:
                break;
        }
    };

    const trapFocus = (event) => {
        if (!focusableElements.length) return;
        const { activeElement } = document;
        const first = focusableElements[0];
        const last = focusableElements[focusableElements.length - 1];

        if (event.shiftKey) {
            if (activeElement === first || !viewer.contains(activeElement)) {
                event.preventDefault();
                last.focus();
            }
        } else if (activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    };

    const openViewer = (trigger) => {
        const images = parseImages(trigger.dataset.storyImages);
        if (!images.length) return;

        pages = images;
        activeTitle = trigger.dataset.storyTitle || 'Story';
        previousFocus = document.activeElement;

        viewer.removeAttribute('hidden');
        document.body.classList.add('story-viewer-open');

        if (titleEl) {
            titleEl.textContent = activeTitle;
        }

        setImage(0, { skipAnimation: true });
        refreshFocusable();

        if (closeButton) {
            closeButton.focus();
        }

        keydownHandler = handleKeydown;
        document.addEventListener('keydown', keydownHandler, true);
    };

    const closeViewer = () => {
        viewer.setAttribute('hidden', '');
        document.body.classList.remove('story-viewer-open');

        document.removeEventListener('keydown', keydownHandler, true);
        keydownHandler = null;

        if (previousFocus && typeof previousFocus.focus === 'function') {
            previousFocus.focus();
        }
    };

    const showNext = () => setImage(activeIndex + 1);
    const showPrevious = () => setImage(activeIndex - 1);

    triggers.forEach((trigger) => {
        trigger.addEventListener('click', () => openViewer(trigger));
        trigger.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
                event.preventDefault();
                openViewer(trigger);
            }
        });
    });

    if (closeButton) {
        closeButton.addEventListener('click', closeViewer);
    }

    if (dismissBackdrop) {
        dismissBackdrop.addEventListener('click', closeViewer);
    }

    if (prevButton) {
        prevButton.addEventListener('click', showPrevious);
    }

    if (nextButton) {
        nextButton.addEventListener('click', showNext);
    }

    viewer.addEventListener('transitionend', () => refreshFocusable());

    if (stage) {
        stage.addEventListener(
            'touchstart',
            (event) => {
                if (event.touches.length === 1) {
                    touchStartX = event.touches[0].clientX;
                }
            },
            { passive: true }
        );

        stage.addEventListener(
            'touchend',
            (event) => {
                if (touchStartX === null) return;
                const touchEndX = event.changedTouches[0].clientX;
                const deltaX = touchEndX - touchStartX;
                const threshold = 40;

                if (Math.abs(deltaX) > threshold) {
                    if (deltaX < 0) {
                        showNext();
                    } else {
                        showPrevious();
                    }
                }

                touchStartX = null;
            },
            { passive: true }
        );
    }
})();
