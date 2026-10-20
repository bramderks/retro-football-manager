# Retro Football Manager — desktop prototype
# Python 3 + Tkinter; no third-party packages required.
# Run: py retro_manager.py

import random
import tkinter as tk
from tkinter import ttk
from datetime import datetime

BG = "#0b1724"
PANEL = "#132638"
PANEL2 = "#1b3448"
TEXT = "#e8f0f5"
MUTED = "#9eb2c3"
ACCENT = "#d5b45c"
GREEN = "#2d654f"
RED = "#8e3d43"

class RetroManager:
    def __init__(self, root):
        self.root = root
        self.root.title("Retro Football Manager")
        self.root.geometry("1100x720")
        self.root.minsize(900, 600)
        self.root.configure(bg=BG)
        self.minute = 0
        self.home_goals = 0
        self.away_goals = 0
        self.home_stats = {"Schoten": 0, "Op doel": 0, "Kansen": 0, "Corners": 0}
        self.away_stats = {"Schoten": 0, "Op doel": 0, "Kansen": 0, "Corners": 0}
        self.running = False
        self.after_id = None
        self.speed_ms = 900
        self.build_ui()
        self.new_match()

    def label(self, parent, text, size=11, bold=False, color=TEXT, **kwargs):
        return tk.Label(parent, text=text, bg=kwargs.pop("bg", PANEL),
                        fg=color, font=("Segoe UI", size, "bold" if bold else "normal"),
                        **kwargs)

    def build_ui(self):
        top = tk.Frame(self.root, bg="#07111b", height=66)
        top.pack(fill="x")
        top.pack_propagate(False)
        self.label(top, "RETRO FOOTBALL MANAGER", 20, True, ACCENT, bg="#07111b").pack(side="left", padx=22)
        self.label(top, "DESKTOP PROTOTYPE  •  v0.3", 10, True, MUTED, bg="#07111b").pack(side="right", padx=22)

        nav = tk.Frame(self.root, bg=PANEL2, height=42)
        nav.pack(fill="x")
        nav.pack_propagate(False)
        for name in ("Overzicht", "Wedstrijd", "Selectie", "Tactiek", "Competitie", "Transfers"):
            b = tk.Button(nav, text=name, command=lambda n=name: self.nav_click(n),
                          bg=PANEL2, fg=TEXT, activebackground=ACCENT, activeforeground=BG,
                          relief="flat", padx=18, pady=9, font=("Segoe UI", 10, "bold"),
                          cursor="hand2")
            b.pack(side="left")

        main = tk.Frame(self.root, bg=BG)
        main.pack(fill="both", expand=True, padx=16, pady=14)
        left = tk.Frame(main, bg=PANEL, width=245)
        left.pack(side="left", fill="y", padx=(0, 12))
        left.pack_propagate(False)
        self.label(left, "WEDSTRIJDINFO", 10, True, ACCENT).pack(anchor="w", padx=14, pady=(16, 10))
        self.label(left, "Vriendschappelijk", 12, True).pack(anchor="w", padx=14)
        self.label(left, "Amsterdam Arena  •  20:00", 9, False, MUTED).pack(anchor="w", padx=14, pady=(3, 18))
        self.label(left, "WEDSTRIJDSTATISTIEKEN", 10, True, ACCENT).pack(anchor="w", padx=14, pady=(0, 8))
        self.stat_labels = {}
        for key in ("Balbezit", "Schoten", "Op doel", "Kansen", "Corners"):
            row = tk.Frame(left, bg=PANEL)
            row.pack(fill="x", padx=14, pady=5)
            self.label(row, key, 10, False, MUTED).pack(side="left")
            val = self.label(row, "0 - 0", 10, True)
            val.pack(side="right")
            self.stat_labels[key] = val
        self.label(left, "SPELREGELAARS", 10, True, ACCENT).pack(anchor="w", padx=14, pady=(25, 8))
        self.label(left, "TACTISCHE INSTELLINGEN", 10, True, ACCENT).pack(anchor="w", padx=14, pady=(12, 5))
        self.tactic_vars = {}
        self.add_choice(left, "Mentaliteit", "mentaliteit", ("Verdedigend", "Normaal", "Aanvallend"), "Normaal")
        self.add_choice(left, "Passing", "passing", ("Kort", "Direct", "Lang"), "Direct")
        self.add_choice(left, "Pressie", "pressie", ("Uit", "Aan"), "Uit")
        self.add_choice(left, "Buitenspelval", "offside", ("Uit", "Aan"), "Uit")
        self.add_choice(left, "Counter", "counter", ("Uit", "Aan"), "Uit")
        self.add_choice(left, "Tackelen", "tackles", ("Normaal", "Hard"), "Normaal")
        controls = tk.Frame(left, bg=PANEL)
        controls.pack(fill="x", padx=12)
        self.start_btn = tk.Button(controls, text="▶  Start", command=self.start,
                                   bg=GREEN, fg="white", relief="flat", padx=10, pady=8, cursor="hand2")
        self.start_btn.grid(row=0, column=0, sticky="ew", padx=2, pady=3)
        self.pause_btn = tk.Button(controls, text="Ⅱ  Pauze", command=self.pause,
                                   bg=PANEL2, fg=TEXT, relief="flat", padx=10, pady=8, cursor="hand2")
        self.pause_btn.grid(row=0, column=1, sticky="ew", padx=2, pady=3)
        self.continue_btn = tk.Button(controls, text="▶▶ Verder", command=self.start,
                                      bg=PANEL2, fg=TEXT, relief="flat", padx=10, pady=8, cursor="hand2")
        self.continue_btn.grid(row=1, column=0, sticky="ew", padx=2, pady=3)
        self.new_btn = tk.Button(controls, text="↻ Nieuwe match", command=self.new_match,
                                 bg=PANEL2, fg=TEXT, relief="flat", padx=10, pady=8, cursor="hand2")
        self.new_btn.grid(row=1, column=1, sticky="ew", padx=2, pady=3)
        controls.columnconfigure(0, weight=1)
        controls.columnconfigure(1, weight=1)
        self.speed = tk.StringVar(value="Normaal")
        self.label(left, "Tempo", 9, False, MUTED).pack(anchor="w", padx=14, pady=(12, 2))
        speed_box = ttk.Combobox(left, textvariable=self.speed, values=("Langzaam", "Normaal", "Snel", "Ultra"),
                                 state="readonly")
        speed_box.pack(fill="x", padx=14)
        speed_box.bind("<<ComboboxSelected>>", self.change_speed)

        right = tk.Frame(main, bg=BG)
        right.pack(side="left", fill="both", expand=True)
        scoreboard = tk.Frame(right, bg=PANEL, height=142)
        scoreboard.pack(fill="x")
        scoreboard.pack_propagate(False)
        self.label(scoreboard, "EREDIVISIE  •  TESTWEDSTRIJD", 9, True, ACCENT).pack(pady=(12, 4))
        scoreline = tk.Frame(scoreboard, bg=PANEL)
        scoreline.pack(fill="x", expand=True, padx=30)
        self.home_name = self.label(scoreline, "AJAX", 18, True)
        self.home_name.pack(side="left", expand=True)
        self.score = self.label(scoreline, "0  -  0", 28, True, ACCENT)
        self.score.pack(side="left", padx=20)
        self.away_name = self.label(scoreline, "NEC", 18, True)
        self.away_name.pack(side="left", expand=True)
        self.clock = self.label(scoreboard, "00:00  •  WACHT OP AFTRAP", 10, True, MUTED)
        self.clock.pack(pady=(0, 10))

        events_head = tk.Frame(right, bg=PANEL2)
        events_head.pack(fill="x", pady=(12, 0))
        self.label(events_head, "LIVE WEDSTRIJDCOMMENTAAR", 10, True, ACCENT, bg=PANEL2).pack(side="left", padx=14, pady=10)
        self.status = self.label(events_head, "KLAAR", 9, True, MUTED, bg=PANEL2)
        self.status.pack(side="right", padx=14)
        feed_frame = tk.Frame(right, bg=PANEL)
        feed_frame.pack(fill="both", expand=True)
        self.feed = tk.Text(feed_frame, bg="#0e1d2a", fg=TEXT, insertbackground=TEXT,
                            relief="flat", wrap="word", font=("Consolas", 11),
                            padx=14, pady=12, state="disabled")
        scroll = ttk.Scrollbar(feed_frame, command=self.feed.yview)
        self.feed.configure(yscrollcommand=scroll.set)
        self.feed.pack(side="left", fill="both", expand=True)
        scroll.pack(side="right", fill="y")
        self.feed.tag_configure("minute", foreground=ACCENT)
        self.feed.tag_configure("goal", foreground="#ffcf62", font=("Consolas", 11, "bold"))
        self.feed.tag_configure("system", foreground=MUTED)
        footer = tk.Frame(self.root, bg="#07111b")
        footer.pack(fill="x")
        self.footer_text = self.label(footer, "Retro Football Manager • lokaal prototype • voortgang wordt nog niet opgeslagen",
                                      9, False, MUTED, bg="#07111b")
        self.footer_text.pack(side="left", padx=16, pady=8)

    def add_choice(self, parent, title, key, options, default):
        row = tk.Frame(parent, bg=PANEL)
        row.pack(fill="x", padx=14, pady=2)
        self.label(row, title, 9, False, MUTED).pack(side="left")
        var = tk.StringVar(value=default)
        self.tactic_vars[key] = var
        box = ttk.Combobox(row, textvariable=var, values=options, state="readonly", width=12)
        box.pack(side="right")

    def nav_click(self, name):
        if name != "Wedstrijd":
            self.log("SYSTEEM", f"{name}: dit onderdeel staat op de ontwikkelplanning.", "system")

    def log(self, prefix, message, tag=None):
        self.feed.configure(state="normal")
        self.feed.insert("end", f"{prefix:>4}  {message}\n", tag) if tag else self.feed.insert("end", f"{prefix:>4}  {message}\n")
        self.feed.see("end")
        self.feed.configure(state="disabled")

    def new_match(self):
        self.pause()
        self.minute = 0
        self.home_goals = self.away_goals = 0
        self.home_stats = {"Schoten": 0, "Op doel": 0, "Kansen": 0, "Corners": 0}
        self.away_stats = {"Schoten": 0, "Op doel": 0, "Kansen": 0, "Corners": 0}
        self.feed.configure(state="normal")
        self.feed.delete("1.0", "end")
        self.feed.configure(state="disabled")
        self.clock.configure(text="00:00  •  WACHT OP AFTRAP")
        self.status.configure(text="KLAAR")
        self.update_score()
        self.update_stats()
        self.log("INFO", "De spelers staan klaar voor de aftrap.", "system")
        self.log("VAR", "VAR is actief: doelpunten en strafschopmomenten kunnen worden herbeoordeeld.", "system")
        self.log("INFO", "Druk op Start om de wedstrijd te beginnen.", "system")

    def start(self):
        if self.minute >= 90:
            return
        if not self.running:
            self.running = True
            self.status.configure(text="LIVE", fg="#78d6a5")
            self.tick()

    def pause(self):
        self.running = False
        if self.after_id:
            try:
                self.root.after_cancel(self.after_id)
            except tk.TclError:
                pass
            self.after_id = None
        if hasattr(self, "status"):
            self.status.configure(text="PAUZE" if self.minute else "KLAAR", fg=MUTED)

    def change_speed(self, _event=None):
        self.speed_ms = {"Langzaam": 1500, "Normaal": 900, "Snel": 350, "Ultra": 175}.get(self.speed.get(), 900)

    def tick(self):
        if not self.running:
            return
        self.minute += 1
        self.clock.configure(text=f"{self.minute:02d}:00  •  {'RUST' if self.minute == 45 else 'LIVE WEDSTRIJD'}")
        if self.minute == 1:
            self.log(" 1'", "Aftrap! Ajax brengt de bal aan het rollen.", "minute")
        else:
            self.simulate_event()
        self.update_score()
        self.update_stats()
        if self.minute == 45:
            self.log("45'", "Rust! De spelers zoeken de kleedkamer op.", "system")
        if self.minute >= 90:
            self.running = False
            self.status.configure(text="AFGELOPEN", fg=ACCENT)
            self.clock.configure(text="90:00  •  EINDE WEDSTRIJD")
            self.log("90'", f"Afgefloten! Ajax {self.home_goals} - {self.away_goals} NEC.", "goal")
            self.log("INFO", "Eindstatistieken zijn bijgewerkt.", "system")
            return
        self.after_id = self.root.after(self.speed_ms, self.tick)

    def simulate_event(self):
        ht = {k: v.get() for k, v in self.tactic_vars.items()}
        # Ajax has higher reputation and player quality; NEC can still threaten on counters.
        home_rating = 88 + 92 * 0.12 + {"Verdedigend": -7, "Normaal": 0, "Aanvallend": 7}[ht["mentaliteit"]]
        home_rating += {"Kort": 3, "Direct": 2, "Lang": -1}[ht["passing"]]
        home_rating += 3 if ht["pressie"] == "Aan" else 0
        home_rating += 2 if ht["counter"] == "Aan" else 0
        away_rating = 70 + 68 * 0.12 + (5 if random.random() < 0.35 else 0)
        home_share = max(0.24, min(0.82, 0.50 + (home_rating - away_rating) * 0.012))
        home_attacks = random.random() < home_share
        team = "Ajax" if home_attacks else "NEC"
        other = "NEC" if home_attacks else "Ajax"
        own = self.home_stats if home_attacks else self.away_stats
        opp = self.away_stats if home_attacks else self.home_stats
        r = random.random()
        stamp = f"{self.minute:2d}'"
        if r < 0.31:
            self.log(stamp, f"{team} bouwt rustig op vanuit de verdediging.", "minute")
        elif r < 0.48:
            self.log(stamp, f"{team} verovert de bal en zoekt direct de diepte.")
        elif r < 0.63:
            own["Kansen"] += 1
            self.log(stamp, f"{team} komt door over de flank en geeft voor!")
            if random.random() < 0.55:
                own["Schoten"] += 1
                self.log("   ", f"Schot! De verdediging van {other} blokkeert de poging.")
            else:
                own["Corners"] += 1
                self.log("   ", f"De bal wordt weggewerkt: corner voor {team}.")
        elif r < 0.79:
            own["Schoten"] += 1
            self.log(stamp, f"{team} haalt uit van afstand!")
            if random.random() < 0.52:
                own["Op doel"] += 1
                if random.random() < 0.19:
                    if home_attacks:
                        self.home_goals += 1
                    else:
                        self.away_goals += 1
                    self.log("GOAL", f"DOELPUNT voor {team}! De keeper is kansloos!", "goal")
                else:
                    self.log("SAVE", f"Uitstekende redding van de doelman van {other}.")
            else:
                self.log("   ", "Het schot vliegt naast het doel.")
        elif r < 0.87:
            own["Corners"] += 1
            self.log(stamp, f"Corner voor {team}. De bal wordt voor het doel gebracht.")
        elif r < 0.93:
            self.log(stamp, f"Overtreding van {other}. De scheidsrechter fluit.")
        else:
            self.log(stamp, f"Wat een kans voor {team}, maar de afronding ontbreekt!")

    def update_score(self):
        self.score.configure(text=f"{self.home_goals}  -  {self.away_goals}")

    def update_stats(self):
        total_shots = self.home_stats["Schoten"] + self.away_stats["Schoten"]
        hpos = 50 if total_shots == 0 else max(35, min(65, 50 + (self.home_stats["Kansen"] - self.away_stats["Kansen"]) * 2))
        values = {
            "Balbezit": f"{hpos}% - {100-hpos}%",
            "Schoten": f'{self.home_stats["Schoten"]} - {self.away_stats["Schoten"]}',
            "Op doel": f'{self.home_stats["Op doel"]} - {self.away_stats["Op doel"]}',
            "Kansen": f'{self.home_stats["Kansen"]} - {self.away_stats["Kansen"]}',
            "Corners": f'{self.home_stats["Corners"]} - {self.away_stats["Corners"]}',
        }
        for key, value in values.items():
            self.stat_labels[key].configure(text=value)

if __name__ == "__main__":
    root = tk.Tk()
    app = RetroManager(root)
    root.mainloop()
