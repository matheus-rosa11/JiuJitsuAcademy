export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "theme";

/** Runs in <head> before the first paint: saved choice, otherwise the OS preference. */
export const themeScript = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=t}catch(e){}})()`;
