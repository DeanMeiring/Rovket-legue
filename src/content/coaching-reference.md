# Rocket League Coaching Reference (Diamond to Grand Champion, 3v3 Standard only)

For an AI reviewer writing feedback on university club players from per-game ballchasing.com stats. Scope: 3v3 (Standard) only. Ignore any 2v2 or 1v1 replays. Read the "Source reliability" notes before quoting any number to a player.

## 0. Source reliability (read first)

- **Pro (RLCS) numbers are well sourced.** They come from the ballchasing.com player-stats page for the RLCS 2024 World Championship group (https://ballchasing.com/group/world-championship-md058mxx2x/players-stats). They are per-game averages for a handful of named players, read on 2026-09-28. RLCS is played in 3v3, so these numbers match the club's playlist.
- **Ranked-tier numbers (Diamond, Champion, GC) are NOT sourced.** Ballchasing.com has rank-average pages (https://ballchasing.com/population/average and /population/distribution), but they load their data with JavaScript and it could not be read for this document. No published analysis gave per-rank values either. Anything below about ranked tiers is **directional only** ("higher / lower than pros"). Never quote it as a figure.
- **Recommended practice:** compare a player first to their own history, and second to the club's own spread of values, which comes from the same replays. Use the pro values only as a ceiling, never as a target for a Diamond player.

## 1. Benchmarks

### 1a. Pro 3v3 per-game values (RLCS 2024 World Championship, ballchasing.com)

Source: https://ballchasing.com/group/world-championship-md058mxx2x/players-stats. The rows are Zen (22 games), Atow. (30), Firstkiller (16), Alpha54 and ExoTiiK. Core per-game values were computed from the totals and game counts on that page.

| Stat | Pro values seen | Notes |
|---|---|---|
| Goals / game | ~0.55 to 0.85 | Zen 12 in 22 games; Atow. 25 in 30; Firstkiller 12 in 16 |
| Assists / game | ~0.3 to 0.7 | Zen 7/22, Atow. 21/30 |
| Saves / game | ~1.4 to 1.8 | Zen 40/22, Atow. 41/30, Firstkiller 22/16 |
| Shots / game | ~2.9 to 3.2 | |
| Score / game | ~355 to 400 | Zen ~383, Atow. ~400, Firstkiller ~357 |
| Shooting % | ~16% to 27% | Shown on the page |
| Boost per minute (BPM) | 432 to 478 | Zen 432.6, Alpha54 448.9, Atow. 478.1 |
| Big pads / game | ~22 to 23 | |
| Small pads / game | ~71 to 96 | Atow. 95.7 (a heavy small-pad user) |
| Stolen big pads / game | ~3.5 to 4.7 | |
| Time at 0 boost | ~49 to 51 s per game | Given in seconds. A 5-minute game is about 300+ s, so roughly 15% |
| Time at 100 boost | ~38 to 47 s per game | Given in seconds |
| Avg speed | ~1,606 to 1,660 uu/s | |
| % supersonic | ~20 to 21% | |
| % boost speed | ~38 to 45% | |
| % slow speed | ~36 to 41% | |
| % on ground | ~52 to 56% | |
| % low air | ~36 to 40% | |
| % high air | ~8 to 9% | |
| % behind ball | ~71 to 77% | |
| % defensive third | ~43 to 47% | |
| % neutral third | ~30 to 34% | |
| % offensive third | ~21 to 24% | |
| Avg distance to teammates | ~3,350 to 3,730 uu | |
| Avg distance to ball | ~2,600 to 2,830 uu | |
| Demos inflicted / game | ~1 to 2.4 | Varies a lot by player style (Atow. 71 in 30 games) |

The page did not clearly show values for % most back, average boost amount, % time at 0 boost as a percentage, or goals conceded as last defender, so none are given here.

### 1b. Ranked tiers (Diamond, Champion, GC): directional only, not sourced

| Stat | Expected direction vs pros | Confidence |
|---|---|---|
| Avg speed, % supersonic | Lower at lower ranks: more slow driving, less time at speed | Approximate (general coaching consensus, no figure found) |
| % slow speed | Higher at lower ranks | Approximate |
| % high air | Lower at Diamond, rising toward GC | Approximate |
| BPM | Not reliably lower. Lower-ranked players often burn boost inefficiently, so BPM alone does not tell ranks apart | Approximate |
| Small pads | Usually fewer at lower ranks, which rely more on big pads | Approximate (supported by the Dignitas boost guide's emphasis on small-pad routes) |
| Saves, shots, goals / game | More end-to-end play at lower ranks, so counts can be higher, not lower | Approximate |
| Score / game | Not comparable across ranks, because it depends on the lobby | n/a |

**What does correlate with winning in ranked** (ofischial1, rocket-league-analytics on GitHub, which looked at ranked 3v3 replays from Gold to SSL: https://github.com/ofischial1/rocket-league-analytics):
- goals r = 0.64
- shooting accuracy r = 0.39
- shot volume r = 0.39
- % offensive third r = 0.18
- average boost held r = 0.06
- time at zero boost r = -0.01
- demos had no meaningful correlation, at any rank tier

Lesson: boost numbers on their own barely predict winning. Treat them as clues that explain other problems, not as verdicts.

## 2. What each stat means for a coach

**Core**
- **Goals, assists, shots, shooting %:** these measure attacking output. Shooting % below about 15% suggests low-quality shots (long 50/50s, shots into the keeper). High shots with low goals suggests shot selection needs work.
- **Saves:** a high save count can mean good defence, or it can mean the team keeps conceding chances. Read it together with goals conceded and % most back.
- **Score and MVP:** noisy, driven by the lobby, and they reward ball touches. Do not rank players on score alone.
- **Win:** meaningful only over many games. Individual stats explain some of the win rate, not all of it.

**Boost**
- **BPM (role-dependent):** high BPM with high % supersonic suggests efficient pressure. High BPM with low speed and lots of time at 0 suggests wasted boost, for example boosting while already supersonic or boosting off the ground. Third man and last-back players usually run lower BPM.
- **Average boost amount and % time at 0:** long stretches at 0 mean the player can't challenge or save. Pros still sit at 0 for roughly 50 s a game (ballchasing), so being empty is fine. What matters is being empty *while last back*.
- **% time at full boost:** a lot of time at 100 means hoarding, or collecting boost instead of joining the play. It fits a patient third man, but is a warning sign for a first man.
- **Big vs small pads:** a heavy reliance on big pads (with few small pads) means long corner trips that pull the player out of the play. Pros collect about 70 to 95 small pads a game. Coaches teach "small-pad routes" on rotation (Dignitas boost guide).
- **Boost stolen:** taking the opponents' big pads denies them boost. It is good when it comes naturally from an attack, and bad if the player goes deep for it while their team is exposed.

**Movement**
- **Avg speed, % supersonic, % slow:** these are the clearest proxy for pace and game speed. High % slow at Diamond or Champion usually means hesitation, ball-watching, or driving without purpose.
- **% ground / low air / high air:** high air at pro level is about 8 to 9%. Very high air with poor results suggests the player is going for aerials they can't finish. Very low air at Champion or above suggests they are missing aerial challenges.

**Positioning**
- **% behind ball:** being behind the ball (goal side) is safe. Pros are about 71 to 77%. A low value means the player is often caught ahead of play (overcommitting). A very high value can mean passivity.
- **% most back (last man), role-dependent:** in 3v3, an even split would be about 33% each. Consistently much higher means that player is covering for teammates who don't rotate. Much lower means they rarely take their defensive turn.
- **Thirds and halves:** these show where the player spends time, and they depend on role and team style. % offensive third correlated weakly with winning in ranked (ofischial1).
- **Avg distance to teammates:** low values mean bunching or double commits. Very high values mean they are disconnected from the play. Pros sit around 3,400 to 3,700 uu in 3v3.
- **Goals conceded as last defender:** the most direct defensive-error stat. Read it with % most back, because a player who is last back more often has more chances to concede.
- **Demos inflicted and taken:** these depend on style. Taking many demos suggests poor awareness or predictable routes.

**How many games before a number means anything** (a coaching rule of thumb; no published study was found):
- 1 to 3 games: anecdote only. Don't draw conclusions about a trend.
- About 10 games: rough trends in rate stats (speed, % behind ball, BPM, % most back) begin to settle.
- 20 or more games: count stats (goals, saves, demos, goals conceded as last defender) become usable.
- Always say how many games a claim is based on. Compare like with like: 3v3 Standard only, and ideally the same teammates.

## 3. Rotation, positioning and decision-making

**3v3 principles** (Dignitas, "Fundamentals of Rotation in 3v3"; Dignitas, "Importance of the Third Man")
- Three rotating roles. In attack: striker, passer and a deep support player. In defence: the player who clears, the back-post player, and the goalie. Roles change "in an instant."
- Always rotate **back post**, away from the ball side. This keeps the whole play in view and avoids bunching.
- The third man holds boost, reads the play, and covers the counter. They should not chase the play forward.
- Spacing beats speed. Two players beaten by one touch is the classic bunching failure.

**Common mistakes at Diamond to Champion**
- Double commits (two players challenging the same ball) and the third man pushing up too, which leaves no one back.
- Ball-chasing: repeated touches while teammates sit idle, then no rotation out after the touch.
- Over-rotating, meaning backing off a ball that you should have challenged.
- Boost starvation: rotating back with an empty tank, or taking long trips to corner boost instead of small-pad routes.
- Rotating ball side instead of back post. Ball-watching instead of checking where teammates are.
- Choosing mechanics over decisions. ViolentPanda (Dignitas, "Most Common 3v3 Mistakes"): "Decision-making, rotations, and teamplay are the three that make a team good or not."

**How these show up in stats (hints for the reviewer)**
- Double commits or bunching: low distance to teammates, low % behind ball, high goals conceded as last defender.
- Ball-chasing: high % offensive third, low % most back, high BPM, high demos taken.
- Passive or over-rotating: high % most back, high % time at full boost, high % slow, few shots.
- Boost starvation: high % time at 0, few small pads, many big pads.

## 4. How to improve each area

**Training packs** (Dignitas, "Best Training Packs for Every Rank"). Codes as listed there:
- Defence:
  - Shadow Defense 5CCE-FB29-7B05-A0B1 (Diamond)
  - Shadow Defense on low boost 6726-51F1-6B0D-9540 (Champion)
  - Backboard Saves D7F8-FD53-98D1-DAFE
- Mechanics:
  - Thanovic's Diamond Pack 504C-DCCB-6FAB-666C
  - Fast Aerials 97B9-5B48-5277-8A85
  - Speed Flip 936E-C293-5DF5-2D5C
  - Double Taps CAFC-FB3E-3C0F-B8F1
  - Air Dribble Mastery 22C6-636F-E52C-D9E7
  - 50 Shot GC + Warmup 0973-0B96-91BB-39EB
  - Fast Challenges 5804-8F7A-00DB-5558
- Widely known named packs (Dignitas, "Ultimate Training Guide"):
  - "Uncomfortable Saves"
  - SunlessKhan's shadow defence pack
  - jstn's "Wall Clears"
  - Rizzo's "Backboard Reads"
  - WayProtein's "Backboard Clears"
  - Biddles' shooting packs
- Training packs can be searched at Prejump (https://prejump.com/training-packs).

**Free play drills** (Dignitas, "Ultimate Training Guide")
- Bounce dribbling.
- Powerslide landings, half-flips and wave dashes for recoveries.
- Full-field half-flip runs.
- Driving at the ball to read wall and backboard bounces.
- Following the ball in the air off wall bounces.
- The guide suggests a roughly 90-minute split across dribbling, aerials, recoveries, defence and striking.

**Workshop maps** (trophi.ai workshop map guide; Dignitas training guide)
- Aerial car control: Lethamyr's Rings maps (Neon, Giant, Medieval Rings) and Obstacle Course 1. Vary how you play them: no air roll, constant air roll, inverted.
- Dribbling: Lethamyr's Dribble Challenge, Dribble Challenge #2 (French Fries) and Noob Dribble (dmc).
- Recoveries and boost control: Speed Jump: Rings 2 & 3 and Speed Jump: Boost (dmc, played with unlimited boost off), and Hornet's Nest.

**Game sense and positioning**
- Play 3v3 with a fixed trio and agree on simple calls ("yours", "mine", "rotating", "boost").
- Review replays (below).

**Replay review habits** (Dignitas, "How to Use Rocket League Replays Like a Pro"; RLH step-by-step replay reviews)
- Look at four areas: positioning and rotations, boost management, challenges, and decision-making.
- Watch from your own point of view first, then from teammates', opponents' and free cam. Ballchasing's 3D viewer gives a top-down view.
- Focus on **one aspect per review**. Take timestamped notes and look for patterns. Review losses without excuses.
- Study pro games with "What, Why, How" questions, pausing often.

**Boost** (Dignitas boost guide)
- Pad facts: a small pad gives 12 boost and a big pad gives 100.
- Keep boost in the tank when you aren't going for the ball.
- The third man conserves the most.
- Use wave dashes, powerslides and flips to keep speed without spending boost.

## 5. How good coaches give feedback

- **Be specific and back it with stats.** Name the stat, the value, the number of games, and the comparison. For example: "% behind ball 58% over 12 games vs your club's typical ~68%. You're getting caught ahead of play."
- **Give one or two priorities at a time.** CoachNow advises one correction per session. Dignitas advises focusing on one aspect per replay review. Put the rest in a "later" list.
- **Link each stat to a behaviour and a drill.** Stat, then the likely cause, then one concrete exercise or habit (pack, map, replay focus).
- **Balance strengths and corrections.** Start with a real strength that the stats support (CoachNow: combine acceptance with challenge).
- **Show, don't just tell.** Point to replay moments or timestamps when they are available (CoachNow).
- **Respect role and context.** A support player who is last back often has naturally low goals and BPM. Do not criticise that as a weakness.
- **State uncertainty.** Flag small samples. Leave out any non-3v3 games. Never present a guess about rank benchmarks as a fact.
- **Make it measurable.** Give a target to re-check over the next 10 or more games, for example "fewer goals conceded as last defender per game" or "+3% time behind ball".

## Sources

- ballchasing.com, RLCS 2024 World Championship players stats: https://ballchasing.com/group/world-championship-md058mxx2x/players-stats
- ballchasing.com, RLCS 2024 group: https://ballchasing.com/group/rlcs-2024-jsvrszynst
- ballchasing.com, population averages (the data loads with JavaScript and could not be read): https://ballchasing.com/population/average
- ballchasing.com, FAQ (stat categories): https://ballchasing.com/doc/faq
- GitHub, ofischial1/rocket-league-analytics (stats vs winning, ranked 3v3): https://github.com/ofischial1/rocket-league-analytics
- Dignitas, A Guide on Boost Management: https://dignitas.gg/articles/boost-management-in-rocket-league
- Dignitas, Fundamentals of Rotation in 3v3: https://dignitas.gg/articles/rocket-league-the-fundamentals-of-rotation-in-3v3
- Dignitas, Importance of the Third Man: https://dignitas.gg/articles/the-importance-of-the-third-man-a-compilation-of-useful-guides
- Dignitas, Most Common 3v3 Mistakes with ViolentPanda: https://dignitas.gg/articles/news/rocket-league/13263/the-most-common-3v3-mistakes-in-rocket-league-with-violentpanda
- Dignitas, Best Training Packs for Every Rank: https://dignitas.gg/articles/best-training-packs-for-every-rank-in-rocket-league
- Dignitas, Ultimate Training Guide: https://dignitas.gg/articles/blogs/rocket-league/13375/rocket-league-ultimate-training-guide
- Dignitas, How to Use Rocket League Replays Like a Pro: https://dignitas.gg/articles/how-to-use-rocket-league-replays-like-a-pro
- trophi.ai, Best Rocket League Workshop Maps: https://www.trophi.ai/post/best-rocket-league-workshop-maps
- RLH, Step-by-step replay reviews: https://www.rocketleague-help.com/step-by-step-replay-reviews
- Prejump, training pack search: https://prejump.com/training-packs
- CoachNow, How to Give Athlete Feedback That Sticks: https://coachnow.com/blog/give-athlete-feedback
