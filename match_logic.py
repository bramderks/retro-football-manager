"""Match simulation helpers for Retro Football Manager prototype."""
import random

def team_strength(rating, reputation, tactics):
    mental = {"Verdedigend": -7, "Normaal": 0, "Aanvallend": 7}.get(tactics.get("mentaliteit"), 0)
    passing = {"Kort": 3, "Direct": 2, "Lang": -1}.get(tactics.get("passing"), 0)
    return rating + reputation * 0.12 + mental + passing + (3 if tactics.get("pressie") == "Aan" else 0) + (2 if tactics.get("counter") == "Aan" else 0)

def home_attack_probability(home_strength, away_strength):
    return max(0.24, min(0.82, 0.5 + (home_strength - away_strength) * 0.012))

def var_goal_stands():
    """Most goals stand; a small minority are overturned by a VAR check."""
    return random.random() >= 0.10

def var_penalty_decision():
    """Return whether VAR recommends awarding a penalty after review."""
    return random.random() >= 0.55

def penalty_scored(keeper_quality=75):
    return random.random() < max(0.45, min(0.88, 0.82 - (keeper_quality - 70) * 0.008))
