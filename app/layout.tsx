import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Retro Football Manager",
  description: "Een klassieke voetbalmanager, opnieuw opgebouwd voor het web.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="nl"><body>{children}
    <button id="global-theme-toggle" className="theme-toggle" type="button" aria-label="Wissel tussen lichte en donkere modus" style={{position:"fixed",right:18,bottom:18,zIndex:9999,boxShadow:"0 2px 10px #173a5e22"}}>☀ Lichte modus</button>
    <style>{`body:has(.app-shell) #global-theme-toggle{display:none}`}</style>
    <script dangerouslySetInnerHTML={{__html:`(function(){var root=document.documentElement;function apply(theme){root.dataset.theme=theme;var button=document.getElementById("global-theme-toggle");if(button)button.textContent=theme==="light"?"☾ Donkere modus":"☀ Lichte modus";}var saved=localStorage.getItem("rfm-theme")==="light"?"light":"dark";apply(saved);var button=document.getElementById("global-theme-toggle");if(button)button.addEventListener("click",function(){var next=root.dataset.theme==="light"?"dark":"light";localStorage.setItem("rfm-theme",next);apply(next);});})();`}} />
  </body></html>;
}
