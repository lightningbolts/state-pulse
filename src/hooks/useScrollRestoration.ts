import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export const saveScrollPos = (key: string, selector?: string) => {
    let scrollPos = { x: window.scrollX, y: window.scrollY };
    if (selector) {
        const element = document.querySelector(selector);
        if (element) {
            scrollPos = { x: (element as HTMLElement).scrollLeft, y: (element as HTMLElement).scrollTop };
        }
    }
    sessionStorage.setItem(`scrollPos:${key}`, JSON.stringify(scrollPos));
};

export const restoreScrollPos = (key: string, selector?: string) => {
    const json = sessionStorage.getItem(`scrollPos:${key}`);
    const scrollPos = json ? JSON.parse(json) : { x: 0, y: 0 };
    if (selector) {
        const element = document.querySelector(selector);
        if (element) {
            (element as HTMLElement).scrollTo(scrollPos.x, scrollPos.y);
        }
    } else {
        window.scrollTo(scrollPos.x, scrollPos.y);
    }
};

export const deleteScrollPos = (key: string) => {
    sessionStorage.removeItem(`scrollPos:${key}`);
};

interface UseScrollRestorationOptions {
    router?: any;
    enabled?: boolean;
    selector?: string | null;
    delay?: number | null;
}

export function useScrollRestoration({ router = null, enabled = true, selector = null, delay = null }: UseScrollRestorationOptions = {}) {
    const nextRouter = useRouter();
    if (!router) {
        router = nextRouter;
    }
    const [key, setKey] = useState<string | null>(null);

    useEffect(() => {
        if (typeof window !== 'undefined' && window.history.state && window.history.state.key) {
            setKey(window.history.state.key);
        }
    }, []);

    useEffect(() => {
        if (!enabled || !key) return;

        const onBeforeUnload = () => {
            deleteScrollPos(key);
            if (window.history.state && window.history.state.key) {
                deleteScrollPos(window.history.state.key);
            }
        };

        const onRouteChangeStart = () => {
            saveScrollPos(key, selector || undefined);
        };

        const onRouteChangeComplete = () => {
            if (typeof window !== 'undefined' && window.history.state && window.history.state.key) {
                setKey(window.history.state.key);
                const restore = () => {
                    restoreScrollPos(window.history.state.key, selector || undefined);
                    deleteScrollPos(window.history.state.key);
                };
                if (delay != null) {
                    setTimeout(restore, delay);
                } else {
                    restore();
                }
            }
        };

        window.addEventListener('beforeunload', onBeforeUnload);
        if (router && router.events) {
            router.events.on('routeChangeStart', onRouteChangeStart);
            router.events.on('routeChangeComplete', onRouteChangeComplete);
        }

        return () => {
            window.removeEventListener('beforeunload', onBeforeUnload);
            if (router && router.events) {
                router.events.off('routeChangeStart', onRouteChangeStart);
                router.events.off('routeChangeComplete', onRouteChangeComplete);
            }
        };
    }, [enabled, key, selector, delay, router]);
}
