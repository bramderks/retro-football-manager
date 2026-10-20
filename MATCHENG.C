/*
 * RETRO FOOTBALL MANAGER - MATCH ENGINE v0.1
 * C89-compatible prototype for a real DOS executable.
 *
 * Intended for Turbo C / Borland C or Open Watcom targeting DOS.
 * Example (compiler options vary by installation):
 *   wcl -bt=dos -ml MATCHENG.C
 *
 * Run:
 *   MATCHENG.EXE
 *   MATCHENG.EXE 12345
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#define TEAM_SIZE 11
#define MATCH_MINUTES 90

typedef struct {
    char name[20];
    int finishing;
    int passing;
    int tackling;
    int positioning;
    int goalkeeping;
} Player;

typedef struct {
    char name[24];
    Player players[TEAM_SIZE];
    int attack_style; /* 0 = balanced, 1 = attacking, 2 = counter */
    int pressing;     /* 0 = low, 1 = normal, 2 = high */
    int goals;
    int shots;
    int shots_on_target;
    int chances;
    int possession_ticks;
    int corners;
} Team;

static int random_range(int low, int high)
{
    if (high <= low) return low;
    return low + (rand() % (high - low + 1));
}

static int clamp_int(int value, int low, int high)
{
    if (value < low) return low;
    if (value > high) return high;
    return value;
}

static void init_player(Player *p, const char *name,
                        int fin, int pass, int tack, int pos, int gk)
{
    strncpy(p->name, name, sizeof(p->name) - 1);
    p->name[sizeof(p->name) - 1] = '\0';
    p->finishing = fin;
    p->passing = pass;
    p->tackling = tack;
    p->positioning = pos;
    p->goalkeeping = gk;
}

static void reset_stats(Team *t)
{
    t->goals = 0;
    t->shots = 0;
    t->shots_on_target = 0;
    t->chances = 0;
    t->possession_ticks = 0;
    t->corners = 0;
}

static void init_teams(Team *home, Team *away)
{
    strcpy(home->name, "Ajax");
    home->attack_style = 1;
    home->pressing = 2;
    reset_stats(home);

    init_player(&home->players[0], "Van Dijk", 7, 12, 15, 15, 1);
    init_player(&home->players[1], "Smit", 8, 13, 14, 14, 1);
    init_player(&home->players[2], "Bakker", 6, 12, 15, 14, 1);
    init_player(&home->players[3], "De Boer", 7, 14, 13, 15, 1);
    init_player(&home->players[4], "Visser", 10, 15, 10, 14, 1);
    init_player(&home->players[5], "Jansen", 9, 14, 11, 13, 1);
    init_player(&home->players[6], "Kok", 12, 13, 8, 13, 1);
    init_player(&home->players[7], "Meijer", 13, 12, 7, 12, 1);
    init_player(&home->players[8], "De Jong", 15, 10, 6, 14, 1);
    init_player(&home->players[9], "Peters", 14, 11, 5, 13, 1);
    init_player(&home->players[10], "Bos", 1, 10, 1, 14, 16);

    strcpy(away->name, "NEC");
    away->attack_style = 2;
    away->pressing = 1;
    reset_stats(away);

    init_player(&away->players[0], "Willems", 6, 11, 14, 13, 1);
    init_player(&away->players[1], "Jansen", 7, 12, 13, 13, 1);
    init_player(&away->players[2], "Martens", 6, 11, 14, 14, 1);
    init_player(&away->players[3], "Schaap", 7, 12, 13, 13, 1);
    init_player(&away->players[4], "Verbeek", 9, 12, 10, 12, 1);
    init_player(&away->players[5], "Van Leeuwen", 8, 11, 11, 12, 1);
    init_player(&away->players[6], "Kramer", 10, 10, 8, 12, 1);
    init_player(&away->players[7], "Driessen", 11, 10, 7, 12, 1);
    init_player(&away->players[8], "Santos", 13, 9, 5, 12, 1);
    init_player(&away->players[9], "De Wit", 12, 10, 6, 12, 1);
    init_player(&away->players[10], "Verhoeven", 1, 9, 1, 13, 14);
}

static int team_passing(const Team *t)
{
    int total = 0;
    int i;
    for (i = 0; i < TEAM_SIZE - 1; ++i) total += t->players[i].passing;
    return total / (TEAM_SIZE - 1);
}

static int team_tackling(const Team *t)
{
    int total = 0;
    int i;
    for (i = 0; i < TEAM_SIZE - 1; ++i) total += t->players[i].tackling;
    return total / (TEAM_SIZE - 1);
}

static int team_finishing(const Team *t)
{
    int total = 0;
    int i;
    for (i = 6; i < 10; ++i) total += t->players[i].finishing;
    return total / 4;
}

static int team_attack_modifier(const Team *t)
{
    if (t->attack_style == 1) return 3;
    if (t->attack_style == 2) return -1;
    return 0;
}

static void print_score(const Team *home, const Team *away, int minute)
{
    printf("\n%2d'  %s %d - %d %s\n",
           minute, home->name, home->goals, away->goals, away->name);
}

static void simulate_attack(Team *att, Team *def,
                            Team *home, Team *away, int minute)
{
    int passing;
    int tackling;
    int chance_roll;
    int shot_roll;
    int save_roll;
    int shooter_index;
    int shooter_finishing;
    int build_up_chance;
    int shot_accuracy;
    int keeper_quality;
    int save_chance;

    passing = team_passing(att);
    tackling = team_tackling(def);

    build_up_chance = clamp_int(48 + passing - tackling
                                + team_attack_modifier(att)
                                + (att->pressing == 2 ? 2 : 0), 22, 72);
    chance_roll = random_range(1, 100);

    if (chance_roll > build_up_chance) {
        if (random_range(1, 100) <= 18) {
            att->corners++;
            printf("%2d'  %s zet druk; de verdediging werkt weg over de achterlijn. Corner.\n",
                   minute, att->name);
        } else {
            printf("%2d'  De aanval van %s loopt vast; %s verovert de bal.\n",
                   minute, att->name, def->name);
        }
        return;
    }

    att->chances++;
    shooter_index = random_range(6, 9);
    shooter_finishing = att->players[shooter_index].finishing;
    printf("%2d'  %s komt door. %s krijgt ruimte om uit te halen!\n",
           minute, att->name, att->players[shooter_index].name);

    att->shots++;
    shot_accuracy = clamp_int(34 + shooter_finishing * 2
                              + (passing - 11) - tackling, 12, 72);
    shot_roll = random_range(1, 100);

    if (shot_roll <= shot_accuracy) {
        att->shots_on_target++;
        keeper_quality = def->players[TEAM_SIZE - 1].goalkeeping;
        save_chance = clamp_int(42 + keeper_quality * 2, 45, 82);
        save_roll = random_range(1, 100);

        if (save_roll > save_chance) {
            att->goals++;
            print_score(home, away, minute);
            printf("     DOELPUNT! %s rondt uitstekend af.\n",
                   att->players[shooter_index].name);
        } else {
            printf("     Schot op doel! De keeper van %s redt uitstekend.\n",
                   def->name);
            if (random_range(1, 100) <= 25) {
                att->corners++;
                printf("     De bal gaat over de achterlijn: corner voor %s.\n",
                       att->name);
            }
        }
    } else {
        printf("     Het schot van %s gaat naast of wordt geblokt.\n",
               att->players[shooter_index].name);
    }
}

static void simulate_match(Team *home, Team *away)
{
    int minute;
    int possession;
    int home_weight;
    int away_weight;
    int total;

    printf("\n============================================================\n");
    printf("                    %s - %s\n", home->name, away->name);
    printf("============================================================\n");
    printf("Aftrap! De wedstrijd is begonnen.\n");

    home_weight = team_passing(home) + team_attack_modifier(home) + 12;
    away_weight = team_passing(away) + team_attack_modifier(away) + 12;
    if (home_weight < 1) home_weight = 1;
    if (away_weight < 1) away_weight = 1;
    total = home_weight + away_weight;

    for (minute = 1; minute <= MATCH_MINUTES; ++minute) {
        possession = random_range(1, total);

        if (possession <= home_weight) {
            home->possession_ticks++;
            if (random_range(1, 100) <= 24) {
                simulate_attack(home, away, home, away, minute);
            }
        } else {
            away->possession_ticks++;
            if (random_range(1, 100) <= 24) {
                simulate_attack(away, home, home, away, minute);
            }
        }

        if (minute == 45) {
            printf("\n---------------------- RUST ----------------------\n");
            printf("%s %d - %d %s\n", home->name, home->goals,
                   away->goals, away->name);
            printf("De ploegen gaan naar de kleedkamer.\n");
            printf("--------------------------------------------------\n\n");
        }
    }

    printf("\n=================== EINDE WEDSTRIJD ===================\n");
    printf("%s %d - %d %s\n", home->name, home->goals,
           away->goals, away->name);
    printf("Schoten: %s %d, %s %d\n", home->name, home->shots,
           away->name, away->shots);
    printf("Op doel:  %s %d, %s %d\n", home->name, home->shots_on_target,
           away->name, away->shots_on_target);
    printf("Kansen:   %s %d, %s %d\n", home->name, home->chances,
           away->name, away->chances);
    printf("Corners:  %s %d, %s %d\n", home->name, home->corners,
           away->name, away->corners);
    printf("Balbezit (indicatief): %s %d%%, %s %d%%\n",
           home->name, home->possession_ticks * 100 / MATCH_MINUTES,
           away->name, away->possession_ticks * 100 / MATCH_MINUTES);
    printf("=======================================================\n");
}

int main(int argc, char *argv[])
{
    Team home;
    Team away;
    unsigned int seed;

    if (argc > 1) {
        seed = (unsigned int)atoi(argv[1]);
    } else {
        seed = (unsigned int)time(NULL);
    }

    srand(seed);
    init_teams(&home, &away);

    printf("RETRO FOOTBALL MANAGER - MATCH ENGINE v0.1\n");
    printf("DOS text-match prototype | Random seed: %u\n", seed);
    printf("Use MATCHENG.EXE 12345 to repeat a test match.\n");

    simulate_match(&home, &away);

    printf("\nDruk op Enter om af te sluiten...");
    getchar();
    return 0;
}
