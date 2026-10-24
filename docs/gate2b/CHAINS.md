# Gate 2b: what four worlds did by themselves

*Produced by `npx tsx src/conv/gate2b.ts`. Seeds 3, 7, 11, 19, 180 days each, with the conversation layer running and nobody scripted: no player choices, nothing staged. Every request, promise, order, breach, lie and change of mind below is a character’s own decision from his own perception, made by the same respond functions the player meets. Each line carries the decision’s top terms (what weighed most) and the next-best alternative.*

| Seed | Pursuits | …through two or more people | Requests | Chains of 3+ linked requests | Orders agreed | Obligations broken | Belief revisions | Lies | Layer records | Audits |
|---|---|---|---|---|---|---|---|---|---|---|
| 3 | 24 | 5 | 100 | 8 | 17 (10 not meant) | 3 (3 with consequences) | 85 (13 changed a plan) | 0 | 151 KB | clean |
| 7 | 47 | 8 | 100 | 2 | 13 (8 not meant) | 1 (0 with consequences) | 46 (13 changed a plan) | 0 | 131 KB | clean |
| 11 | 35 | 6 | 100 | 0 | 19 (9 not meant) | 6 (6 with consequences) | 41 (11 changed a plan) | 0 | 115 KB | clean |
| 19 | 57 | 12 | 100 | 1 | 16 (13 not meant) | 9 (7 with consequences) | 25 (6 changed a plan) | 12 | 121 KB | clean |

## Seed 3. The longest chain: Hank Moretti → Mario Valenti ⇒ Mario Valenti → Teddy Bellini ⇒ Teddy Bellini → Mickey Costa

```
day 131: Angelo Palumbo, told by Louie Lucchese to leave Lou Palumbo alone: refuse  [refuse 0.32: pride (being told) +0.23, volatility +0.09; against agree 0.19]
day 132: Hank Moretti starts a pursuit: make Angelo Palumbo leave him alone
day 133: Angelo Palumbo, told by Louie Lucchese to leave Lou Palumbo alone: refuse  [refuse 0.32: pride (being told) +0.23, volatility +0.09; against agree 0.21]
day 134: Hank Moretti weighs what to do about Angelo Palumbo: intercessor (Mario Valenti) 0.9, intercessor (Lenny Marino) 0.78, intercessor (Louie Palumbo) 0.73, chair (Mickey Costa) 0.64, protector (Lenny Santoro) 0.55, endure 0.06, pay 0.02
day 134: Hank Moretti asks Mario Valenti to take up his trouble with Angelo Palumbo: accept  [accept 0.26: Angelo’s people on his own streets (as he knows it) +0.75, trouble with another captain -0.52, his regard for Hank +0.18; against refuse 0.16]
day 134: Mario Valenti starts a pursuit: do what he promised (o1868)
day 134: Hank Moretti starts a pursuit: see that Mario Valenti does what he promised (o1868)
day 135: Mario Valenti, on his promise to Hank Moretti (6 days left): act  [act 0.7: regard for Hank +0.39, he gave his word (agreeable) +0.31; against delay 0.28]
day 135: Mario Valenti has what he wanted: do what he promised (o1868) (he took it to Teddy Bellini)
day 136: Mario Valenti asks Teddy Bellini to take up Hank Moretti’s trouble with Angelo Palumbo: accept  [accept 0.3: Angelo’s people on his own streets (as he knows it) +0.75, trouble with another captain -0.52, his regard for Mario +0.22; against refuse 0.16]
day 136: Teddy Bellini starts a pursuit: do what he promised (o1892)
day 136: Mario Valenti starts a pursuit: see that Teddy Bellini does what he promised (o1892)
day 137: Teddy Bellini, on his promise to Mario Valenti (6 days left): act  [act 0.48: regard for Mario +0.45, he gave his word (agreeable) +0.26, what it will cost him -0.22; against delay 0.3]
day 137: Teddy Bellini has what he wanted: do what he promised (o1892) (he took it to Mickey Costa)
day 138: Teddy Bellini asks Mickey Costa to rein in Angelo Palumbo: order  [order 0.49: peace in the family +0.3, his regard for Teddy +0.11, caution +0.08; against refuse 0.41]
day 139: Angelo Palumbo, told by Mickey Costa to leave Hank Moretti alone: agree  [agree 0.41: Mickey is over him +0.45, he never touched him (an insult to be warned off) -0.3, caution +0.12; against refuse 0.14]
day 139: Angelo Palumbo tells Mickey Costa he'll leave Hank Moretti alone, and means it  [obey 0.41: caution +0.18, regard for Mickey +0.15, fear of Mickey +0.08; against violate 0.28]
day 140: Hank Moretti asks Mario Valenti whether he has done it: he says done  [truth 1: he did it +1]
day 140: Hank Moretti now believes ob:o1868: done (Mario Valenti told him); he will think again
day 141: Hank Moretti asks Mario Valenti whether he has done it: he says done  [truth 1: he did it +1]
day 142: Louie Costa asks Mickey Costa to rein in Johnny Lucchese: order  [order 0.48: peace with another family +0.15, what he knows Johnny has done +0.15, his regard for Louie +0.1; against refuse 0.4]
day 142: Hank Moretti asks Mario Valenti whether he has done it: he says done  [truth 1: he did it +1]
day 142: Mario Valenti asks Teddy Bellini whether he has done it: he says done  [truth 1: he did it +1]
day 142: Mario Valenti now believes ob:o1892: done (Teddy Bellini told him); he will think again
day 143: Johnny Lucchese, told by Mickey Costa to leave Maria Testa alone: agree  [agree 0.67: Mickey is over him +0.45, caution +0.14, regard for Mickey +0.08; against refuse 0.61]
day 143: Johnny Lucchese tells Mickey Costa he'll leave Maria Testa alone, and does not mean it  [violate 0.57: his grudge against Maria +0.46, what breaking an order costs -0.35, volatility +0.3; against obey 0.52] (not honest)
day 143: Hank Moretti asks Mario Valenti whether he has done it: he says done  [truth 1: he did it +1]
day 143: Mario Valenti asks Teddy Bellini whether he has done it: he says done  [truth 1: he did it +1]
day 144: Hank Moretti asks Mario Valenti whether he has done it: he says done  [truth 1: he did it +1]
day 144: Mario Valenti asks Teddy Bellini whether he has done it: he says done  [truth 1: he did it +1]
```

## Seed 3. An order broken: Mario Testa and Tommy Corrente

```
day 92: Louie Costa asks Tommy Corrente to rein in Mario Testa: order  [order 0.59: peace in the family +0.3, what he knows Mario has done +0.15, his regard for Louie +0.11; against refuse 0.54]
day 93: Mario Testa, told by Tommy Corrente to leave Maria Testa alone: agree  [agree 0.75: Tommy is over him +0.45, regard for Tommy +0.24; against refuse 0.67]
day 93: Mario Testa tells Tommy Corrente he'll leave Maria Testa alone, and does not mean it  [violate 0.6: his grudge against Maria +0.48, what breaking an order costs -0.35, volatility +0.3; against obey 0.47] (not honest)
day 99: Louie Costa asks Mario Testa to rein in Johnny Lucchese: order  [order 0.8: his regard for Louie +0.32, peace in the family +0.3, what he knows Johnny has done +0.15; against refuse 0.49]
day 100: Johnny Lucchese, told by Mario Testa to leave Vincent Lucchese alone: agree  [agree 0.79: Mario is over him +0.45, regard for Mario +0.2, caution +0.14; against refuse 0.53]
day 100: Johnny Lucchese tells Mario Testa he'll leave Vincent Lucchese alone, and does not mean it  [violate 0.63: his grudge against Vincent +0.42, what breaking an order costs -0.35, volatility +0.3; against obey 0.51] (not honest)
day 110: Charlie Cassano asks Mario Testa to rein in Johnny Lucchese: order  [order 0.83: his regard for Charlie +0.35, peace in the family +0.3, what he knows Johnny has done +0.15; against refuse 0.47]
day 114: Tommy Corrente believes Mario Testa went against his order: discipline  [discipline 0.77: an order is an order +0.35, volatility +0.3, pride +0.12; against rebuke 0.19]
day 115: Louie Costa asks Tommy Corrente to rein in Mario Testa: order  [order 0.6: peace in the family +0.3, what he knows Mario has done +0.15, his regard for Louie +0.11; against refuse 0.49]
```

## Seed 3. A plan changed by what he learnt: Jimmy DeSantis

```
day 0: Jimmy DeSantis starts a pursuit: make Ralphie Palumbo leave him alone
day 2: Jimmy DeSantis weighs what to do about Ralphie Palumbo: intercessor (Sal Gallo) 0.51, intercessor (Artie Silvestri) 0.48, askAround 0.24, endure 0.04, pay -0.08
day 3: Jimmy DeSantis answers Ralphie Palumbo's demand: counter  [counter 0.35: fear (bargaining with it takes nerve) +0.4, pride -0.23, he would rather bargain than refuse +0.18; against refuse 0.09]
day 3: Jimmy DeSantis: going to Sal Gallo came to nothing; he thinks again
day 3: Jimmy DeSantis weighs what to do about Ralphie Palumbo: intercessor (Artie Silvestri) 0.49, askAround 0.24, endure 0.04, pay -0.08
day 4: Jimmy DeSantis: going to Artie Silvestri came to nothing; he thinks again
day 4: Jimmy DeSantis weighs what to do about Ralphie Palumbo: askAround 0.24, endure 0.04, pay -0.08
day 4: Jimmy DeSantis asks Artie Silvestri who Ralphie Palumbo answers to: tell  [tell 1.16: he knows +1, trust in Jimmy +0.2]
day 4: Jimmy DeSantis now believes Ralphie Palumbo answers to Charlie Cassano (Artie Silvestri told him); he will think again
day 5: Jimmy DeSantis weighs what to do about Ralphie Palumbo: chair (Charlie Cassano) 0.15, endure 0.04
day 5: Jimmy DeSantis changes his plan: askAround (Artie Silvestri) → chair (Charlie Cassano), because he now believes Ralphie Palumbo answers to Charlie Cassano
day 14: Jimmy DeSantis: tired of waiting on Charlie Cassano; he thinks again
day 14: Jimmy DeSantis weighs what to do about Ralphie Palumbo: endure 0.04
day 14: Jimmy DeSantis gives up: make Ralphie Palumbo leave him alone (there is nothing more he can do)
```

## Seed 3. A lie: Paulie Moretti to Hank Fiore

```
day 69: Hank Fiore starts a pursuit: find out who was behind Fiore's Auto Repair was robbed of $379.
day 71: Hank Fiore asks Marty Giordano who was behind it: unknown  [unknown 0.01: trust in Hank +0.1, caution -0.09]
day 72: Hank Fiore asks Paulie Moretti who was behind it: withhold (not the truth)  [withhold 0.95: he knows who +1, caution -0.15, trust in Hank +0.1] (not honest)
day 73: Hank Fiore asks Mickey Bellini who was behind it: withhold (not the truth)  [withhold 0.93: he knows who +1, caution -0.17, trust in Hank +0.1] (not honest)
day 74: Hank Fiore asks Mario Barone who was behind it: unknown  [unknown 0.08: trust in Hank +0.1]
day 75: Hank Fiore asks Mario Lupo who was behind it: unknown  [unknown 0.03: trust in Hank +0.1, caution -0.07]
day 76: Hank Fiore asks Teddy Ricci who was behind it: unknown  [unknown -0.1: caution -0.2, trust in Hank +0.1]
day 77: Hank Fiore asks Antonia Pellegrino who was behind it: withhold  [withhold 1.13: he knows who +1, trust in Hank +0.19, caution -0.06]
day 78: Hank Fiore asks Nicky Fontana who was behind it: withhold  [withhold 1.03: he knows who +1, trust in Hank +0.1, caution -0.07]
day 79: Hank Fiore asks Artie Neri who was behind it: withhold  [withhold 1.14: he knows who +1, trust in Hank +0.28, caution -0.14]
```

## Seed 3. A promise weighed day by day: Tommy Ricci

```
day 38: Tommy Ricci starts a pursuit: do what he promised (o323)
day 39: Tommy Ricci, on his promise to Dom Cassano (6 days left): delay  [delay 0.28: there is time +0.25; against abandon 0.19]
day 40: Tommy Ricci, on his promise to Dom Cassano (5 days left): delay  [delay 0.28: there is time +0.25; against abandon 0.19]
day 41: Tommy Ricci, on his promise to Dom Cassano (4 days left): delay  [delay 0.28: there is time +0.25; against abandon 0.19]
day 42: Tommy Ricci, on his promise to Dom Cassano (3 days left): act  [act 0.33: he gave his word (agreeable) +0.25, what it will cost him -0.19, the deadline +0.15; against delay 0.28]
day 42: Tommy Ricci has what he wanted: do what he promised (o323) (he took it to Lenny Conti)
```

## Seed 7. The longest chain: Nate Fiore → Tony Cassano ⇒ Tony Cassano → Sammy Zito ⇒ Sammy Zito → Paulie Esposito

```
day 160: Lou Gallo asks Sammy Zito to rein in Louie Russo: order  [order 0.52: peace with another family +0.15, what he knows Louie has done +0.15, caution +0.12; against refuse 0.33]
day 160: Nate Fiore asks Lenny Zito whether he has done it: he says done  [truth 1: he did it +1]
day 161: Marty Greco, told by Hank Zito to leave Lenny Zito alone: refuse  [refuse 0.6: pride (being told) +0.3, his grudge against Lenny +0.21, volatility +0.09; against agree 0.12]
day 161: Louie Moretti asks Sammy Zito to rein in Sonny Ferrara: refuse  [refuse 0.61: his regard for Sonny, his own man +0.34, a civilian’s complaint +0.15, pride (nobody tells him how to run his crew) +0.12; against order 0.56]
day 161: Louie Moretti: going to Sammy Zito came to nothing; he thinks again
day 161: Vincent Sorrento asks Paulie Esposito to take up his trouble with Peter Ricci: refuse  [refuse 0.61: not ours, not worth the friction +0.51, he has not heard of trouble on his streets +0.1; against accept -0.76]
day 161: Nate Fiore: tired of waiting on Lenny Zito; he thinks again
day 161: Nate Fiore weighs what to do about Marty Greco: intercessor (Angelo Zito) 0.74, intercessor (Dom Cassano) 0.71, intercessor (Tony Cassano) 0.7, chair (Paulie Esposito) 0.11, endure 0.06
day 161: Nate Fiore asks Angelo Zito to take up his trouble with Marty Greco: refuse  [refuse 0.55: not ours, not worth the friction +0.45, he has not heard of trouble on his streets +0.1; against accept -0.55]
day 161: Nate Fiore asks Lenny Zito whether he has done it: he says done  [truth 1: he did it +1]
day 162: Vincent Sorrento: going to Paulie Esposito came to nothing; he thinks again
day 162: Nate Fiore: going to Angelo Zito came to nothing; he thinks again
day 162: Nate Fiore weighs what to do about Marty Greco: intercessor (Dom Cassano) 0.71, intercessor (Tony Cassano) 0.7, intercessor (Mario Orsini) 0.67, chair (Paulie Esposito) 0.11, endure 0.06
day 162: Nate Fiore asks Dom Cassano to take up his trouble with Marty Greco: refuse  [refuse 0.21: not ours, not worth the friction +0.51, he has not heard of trouble on his streets -0.3; against accept 0.13]
day 162: Nate Fiore asks Lenny Zito whether he has done it: he says done  [truth 1: he did it +1]
day 163: Nate Fiore: going to Dom Cassano came to nothing; he thinks again
day 163: Nate Fiore weighs what to do about Marty Greco: intercessor (Tony Cassano) 0.7, intercessor (Mario Orsini) 0.67, intercessor (Joey Amato) 0.5, chair (Paulie Esposito) 0.11, endure 0.06
day 163: Nate Fiore asks Tony Cassano to take up his trouble with Marty Greco: accept  [accept 0.21: Marty’s people on his own streets (as he knows it) +0.75, trouble with another captain -0.45, the man is not one of ours -0.15; against refuse 0.13]
day 163: Tony Cassano starts a pursuit: do what he promised (o2318)
day 163: Nate Fiore starts a pursuit: see that Tony Cassano does what he promised (o2318)
day 163: Nate Fiore asks Lenny Zito whether he has done it: he says done  [truth 1: he did it +1]
day 164: Nate Fiore asks Lenny Zito whether he has done it: he says done  [truth 1: he did it +1]
day 164: Tony Cassano, on his promise to Nate Fiore (6 days left): act  [act 0.45: he gave his word (agreeable) +0.29, regard for Nate +0.16; against delay 0.28]
day 164: Tony Cassano has what he wanted: do what he promised (o2318) (he took it to Sammy Zito)
day 165: Hank Barone asks Sammy Zito to rein in Louie Russo: order  [order 0.52: peace with another family +0.15, what he knows Louie has done +0.15, caution +0.12; against refuse 0.34]
day 165: Tony Cassano asks Sammy Zito to take up Nate Fiore’s trouble with Marty Greco: accept  [accept 0.29: Marty’s people on his own streets (as he knows it) +0.75, trouble with another captain -0.55, his regard for Tony +0.23; against refuse 0.17]
day 165: Sammy Zito starts a pursuit: do what he promised (o2355)
day 165: Tony Cassano starts a pursuit: see that Sammy Zito does what he promised (o2355)
day 165: Nate Fiore asks Lenny Zito whether he has done it: he says done  [truth 1: he did it +1]
day 166: Louie Russo, told by Sammy Zito to leave Hank Barone alone: agree  [agree 0.27: Sammy is over him +0.45, he never touched him (an insult to be warned off) -0.3, regard for Sammy +0.09; against refuse 0.06]
```

## Seed 7. A plan changed by what he learnt: Stevie Bruno

```
day 0: Stevie Bruno starts a pursuit: make Lou Leone leave him alone
day 2: Stevie Bruno weighs what to do about Lou Leone: intercessor (Richie Costa) 0.61, intercessor (Paulie Bruno) 0.52, intercessor (Paulie Marino) 0.52, askAround 0.22, endure 0.05, pay 0.05
day 3: Stevie Bruno: going to Richie Costa came to nothing; he thinks again
day 3: Stevie Bruno weighs what to do about Lou Leone: intercessor (Paulie Bruno) 0.52, intercessor (Paulie Marino) 0.52, askAround 0.22, endure 0.05, pay 0.05
day 4: Stevie Bruno: going to Paulie Bruno came to nothing; he thinks again
day 4: Stevie Bruno weighs what to do about Lou Leone: intercessor (Paulie Marino) 0.52, askAround 0.22, endure 0.05, pay 0.05
day 5: Stevie Bruno: going to Paulie Marino came to nothing; he thinks again
day 5: Stevie Bruno weighs what to do about Lou Leone: askAround 0.22, endure 0.05
day 5: Stevie Bruno asks Richie Costa who Lou Leone answers to: tell  [tell 1.16: he knows +1, trust in Stevie +0.21, close to Lou -0.05]
day 5: Stevie Bruno now believes Lou Leone answers to Joey Amato (Richie Costa told him); he will think again
day 6: Stevie Bruno weighs what to do about Lou Leone: chair (Joey Amato) 0.15, endure 0.05
day 6: Stevie Bruno changes his plan: askAround (Richie Costa) → chair (Joey Amato), because he now believes Lou Leone answers to Joey Amato
day 13: Stevie Bruno: tired of waiting on Joey Amato; he thinks again
day 13: Stevie Bruno weighs what to do about Lou Leone: endure 0.05
```

## Seed 7. A lie: Johnny Falco to Louie Moretti

```
day 20: Louie Moretti starts a pursuit: find out who was behind Moretti's Dry Cleaners was robbed of $289.
day 22: Louie Moretti asks Ralphie Fiore who was behind it: unknown  [unknown -0.02: caution -0.12, trust in Louie +0.1]
day 23: Louie Moretti asks Teddy Giordano who was behind it: unknown  [unknown 0.01: trust in Louie +0.1, caution -0.09]
day 24: Louie Moretti asks Johnny Falco who was behind it: withhold (not the truth)  [withhold 1.1: he knows who +1, trust in Louie +0.1] (not honest)
day 25: Louie Moretti asks Lou Gallo who was behind it: unknown  [unknown 0.04: trust in Louie +0.1, caution -0.06]
day 26: Louie Moretti asks Freddie Testa who was behind it: unknown  [unknown -0.02: caution -0.12, trust in Louie +0.1]
day 27: Louie Moretti asks Angelo Zito who was behind it: unknown  [unknown 0.02: trust in Louie +0.1, caution -0.08]
day 28: Louie Moretti asks Charlie Rizzo who was behind it: unknown  [unknown 0.02: trust in Louie +0.1, caution -0.08]
day 29: Louie Moretti asks Johnny Costa who was behind it: unknown  [unknown -0.07: caution -0.17, trust in Louie +0.1]
day 30: Louie Moretti gives up: find out who was behind Moretti's Dry Cleaners was robbed of $289. (nobody would say)
```

## Seed 7. A promise weighed day by day: Rocco Fiore

```
day 111: Rocco Fiore starts a pursuit: do what he promised (o666)
day 112: Rocco Fiore, on his promise to Charlie Marino (6 days left): delay  [delay 0.28: there is time +0.25; against act 0.25]
day 113: Rocco Fiore, on his promise to Charlie Marino (5 days left): delay  [delay 0.28: there is time +0.25; against act 0.25]
day 114: Rocco Fiore, on his promise to Charlie Marino (4 days left): delay  [delay 0.28: there is time +0.25; against act 0.26]
day 115: Rocco Fiore, on his promise to Charlie Marino (3 days left): act  [act 0.41: he gave his word (agreeable) +0.3, what it will cost him -0.2, regard for Charlie +0.16; against delay 0.28]
day 115: Rocco Fiore has what he wanted: do what he promised (o666) (he took it to Sammy Zito)
```

## Seed 11. An order broken: Benny Gallo and Frankie Brancato

```
day 94: Frankie Brancato believes Benny Gallo went against his order: discipline  [discipline 0.62: an order is an order +0.35, volatility +0.18, pride +0.09; against rebuke 0.09]
day 95: Benny Gallo, told by Jimmy Bianchi to leave Sonny Orsini alone: agree  [agree 0.78: Jimmy is over him +0.45, fear of Jimmy +0.18, regard for Jimmy +0.15; against refuse 0.67]
day 95: Benny Gallo tells Jimmy Bianchi he'll leave Sonny Orsini alone, and does not mean it  [violate 0.75: his grudge against Sonny +0.49, what breaking an order costs -0.35, volatility +0.29; against obey 0.56] (not honest)
```

## Seed 11. A plan changed by what he learnt: Sammy Silvestri

```
day 103: Sammy Silvestri starts a pursuit: make Richie Fontana leave him alone
day 105: Sammy Silvestri weighs what to do about Richie Fontana: intercessor (Benny Marchetti) 0.63, intercessor (Sal Neri) 0.48, protector (Marty Galante) 0.48, intercessor (Freddie Cassano) 0.45, askAround 0.21, pay 0.19, endure 0.05
day 106: Sammy Silvestri: going to Benny Marchetti came to nothing; he thinks again
day 106: Sammy Silvestri weighs what to do about Richie Fontana: intercessor (Sal Neri) 0.48, intercessor (Freddie Cassano) 0.46, intercessor (Louie Marino) 0.44, askAround 0.21, endure 0.05
day 107: Sammy Silvestri: going to Sal Neri came to nothing; he thinks again
day 107: Sammy Silvestri weighs what to do about Richie Fontana: intercessor (Benny Gallo) 0.55, intercessor (Freddie Cassano) 0.46, intercessor (Louie Marino) 0.44, askAround 0.21, endure 0.05
day 108: Sammy Silvestri: going to Benny Gallo came to nothing; he thinks again
day 108: Sammy Silvestri weighs what to do about Richie Fontana: intercessor (Freddie Cassano) 0.46, intercessor (Danny Caruso) 0.45, intercessor (Louie Marino) 0.44, askAround 0.21, endure 0.05
day 109: Sammy Silvestri: going to Freddie Cassano came to nothing; he thinks again
day 109: Sammy Silvestri weighs what to do about Richie Fontana: intercessor (Danny Caruso) 0.45, intercessor (Louie Marino) 0.44, askAround 0.21, endure 0.05
day 110: Sammy Silvestri: going to Danny Caruso came to nothing; he thinks again
day 110: Sammy Silvestri weighs what to do about Richie Fontana: intercessor (Louie Marino) 0.44, askAround 0.21, endure 0.05
day 111: Sammy Silvestri: going to Louie Marino came to nothing; he thinks again
day 111: Sammy Silvestri weighs what to do about Richie Fontana: askAround 0.21, endure 0.05
```

## Seed 11. A lie: Bobby Gallo to Joey Lucchese

```
day 87: Joey Lucchese asks Paula Greco who was behind it: unknown  [unknown -0.01: caution -0.11, trust in Joey +0.1]
day 88: Joey Lucchese asks Mickey Orsini who was behind it: unknown  [unknown 0.04: trust in Joey +0.11, caution -0.07]
day 89: Joey Lucchese asks Bobby Gallo who was behind it: withhold (not the truth)  [withhold 1.03: he knows who +1, trust in Joey +0.1, caution -0.07] (not honest)
day 90: Joey Lucchese asks Artie Marino who was behind it: unknown  [unknown 0.05: trust in Joey +0.19, caution -0.14]
day 91: Joey Lucchese asks Sal Caruso who was behind it: unknown  [unknown 0.07: trust in Joey +0.11]
day 92: Joey Lucchese asks Joey Mancini who was behind it: unknown  [unknown 0.02: trust in Joey +0.14, caution -0.12]
day 93: Joey Lucchese asks Rosa Tedesco who was behind it: unknown  [unknown 0.04: trust in Joey +0.1, caution -0.06]
day 94: Joey Lucchese gives up: find out who was behind Lucchese's Laundromat was robbed of $224. (nobody would say)
```

## Seed 11. A promise weighed day by day: Angelo Moretti

```
day 137: Angelo Moretti starts a pursuit: do what he promised (o1676)
day 138: Angelo Moretti, on his promise to Sal Greco (6 days left): delay  [delay 0.28: there is time +0.25; against act 0.18]
day 139: Angelo Moretti, on his promise to Sal Greco (5 days left): delay  [delay 0.28: there is time +0.25; against act 0.18]
day 140: Angelo Moretti, on his promise to Sal Greco (4 days left): delay  [delay 0.28: there is time +0.25; against act 0.18]
day 141: Angelo Moretti, on his promise to Sal Greco (3 days left): act  [act 0.33: he gave his word (agreeable) +0.27, what it will cost him -0.2, the deadline +0.15; against delay 0.28]
day 141: Angelo Moretti has what he wanted: do what he promised (o1676) (he took it to Tony Lombardi)
```

## Seed 19. The longest chain: Paulie Gallo → Lenny Ricci ⇒ Lenny Ricci → Jimmy Marino ⇒ Jimmy Marino → Eddie Testa

```
day 172: Gino Greco asks Lenny Ricci to take up his trouble with Carmine Amato: refuse  [refuse 0.56: not ours, not worth the friction +0.46, he has not heard of trouble on his streets +0.1; against accept -0.54]
day 172: Paulie Gallo: going to Carmine Amato came to nothing; he thinks again
day 172: Paulie Gallo weighs what to do about Rocco Ricci: intercessor (Artie Barone) 0.45, intercessor (Benny Ricci) 0.44, chair (Eddie Testa) 0.41, intercessor (Joey Rizzo) 0.41, endure 0.04
day 172: Paulie Gallo asks Artie Barone to take up his trouble with Rocco Ricci: refuse  [refuse 0.6: not ours, not worth the friction +0.5, he has not heard of trouble on his streets +0.1; against accept -0.73]
day 172: Rocco Greco: going to Eddie Testa came to nothing; he thinks again
day 172: Paulie Gallo asks Nicky Neri whether he has done it: he says done  [truth 1: he did it +1]
day 172: Paulie Gallo now believes ob:o1567: done (Nicky Neri told him); he will think again
day 173: Gino Greco: going to Lenny Ricci came to nothing; he thinks again
day 173: Paulie Gallo: going to Artie Barone came to nothing; he thinks again
day 173: Paulie Gallo weighs what to do about Rocco Ricci: intercessor (Hank Lupo) 0.49, intercessor (Benny Ricci) 0.44, chair (Eddie Testa) 0.41, intercessor (Joey Rizzo) 0.41, endure 0.04
day 173: Paulie Gallo asks Hank Lupo to take up his trouble with Rocco Ricci: refuse  [refuse 0.51: not ours, not worth the friction +0.41, he has not heard of trouble on his streets +0.1; against accept -0.53]
day 173: Paulie Gallo asks Nicky Neri whether he has done it: he says done  [truth 1: he did it +1]
day 173: Nicky Neri asks Jimmy Marino whether he has done it: he says done (a lie)  [lie 0.41: saving face (pride) +0.3, he does not think he will be found out (as he sees it) +0.1, greed for credit +0.1; against truth 0.4] (not honest)
day 174: Gino Greco asks Eddie Testa to take up his trouble with Carmine Amato: refuse  [refuse 0.54: not ours, not worth the friction +0.44, he has not heard of trouble on his streets +0.1; against accept -0.52]
day 174: Paulie Gallo: going to Hank Lupo came to nothing; he thinks again
day 174: Paulie Gallo weighs what to do about Rocco Ricci: intercessor (Benny Ricci) 0.44, chair (Eddie Testa) 0.41, intercessor (Joey Rizzo) 0.41, intercessor (Ralphie Barone) 0.39, endure 0.04
day 174: Paulie Gallo asks Benny Ricci to take up his trouble with Rocco Ricci: refuse  [refuse 0.19: not ours, not worth the friction +0.49, he has not heard of trouble on his streets -0.3; against accept 0.03]
day 174: Paulie Gallo: tired of waiting on Nicky Neri; he thinks again
day 174: Paulie Gallo weighs what to do about Bobby DeSantis: intercessor (Georgie Marchetti) 0.75, intercessor (Ralphie Rizzo) 0.68, intercessor (Frankie Vitale) 0.49, chair (Mickey Neri) 0.35, endure 0.04
day 174: Paulie Gallo asks Georgie Marchetti to take up his trouble with Bobby DeSantis: accept  [accept 0.18: Bobby’s people on his own streets (as he knows it) +0.75, trouble with another captain -0.54, the man is not one of ours -0.15; against refuse 0.17]
day 174: Mickey Testa asks Eddie Testa to take up his trouble with Marty Cassano: refuse  [refuse 0.56: not ours, not worth the friction +0.46, he has not heard of trouble on his streets +0.1; against accept -0.58]
day 174: Paulie Gallo asks Nicky Neri whether he has done it: he says done  [truth 1: he did it +1]
day 174: Dom Lombardi asks Jimmy Marino whether he has done it: he says done (a lie)  [lie 0.41: saving face (pride) +0.3, he does not think he will be found out (as he sees it) +0.1, greed for credit +0.1; against truth 0.17] (not honest)
day 175: Gino Greco: going to Eddie Testa came to nothing; he thinks again
day 175: Charlie DeLuca: tired of waiting on Eddie Testa; he thinks again
day 175: Paulie Gallo: going to Benny Ricci came to nothing; he thinks again
day 175: Paulie Gallo weighs what to do about Rocco Ricci: intercessor (Lenny Ricci) 0.96, chair (Eddie Testa) 0.41, intercessor (Joey Rizzo) 0.41, intercessor (Ralphie Barone) 0.4, endure 0.04
day 175: Paulie Gallo asks Lenny Ricci to take up his trouble with Rocco Ricci: accept  [accept 0.36: Rocco’s people on his own streets (as he knows it) +0.75, trouble with another captain -0.37, the man is not one of ours -0.15; against refuse 0.1]
day 175: Lenny Ricci starts a pursuit: do what he promised (o1873)
day 175: Mickey Testa: going to Eddie Testa came to nothing; he thinks again
```

## Seed 19. An order broken: Frankie Moretti and Vincent Fontana

```
day 19: Peter Orsini asks Vincent Fontana to rein in Frankie Moretti: order  [order 0.39: peace with another family +0.15, caution +0.14, his regard for Peter +0.1; against refuse 0.38]
day 20: Frankie Moretti, told by Vincent Fontana to leave Peter Orsini alone: agree  [agree 0.44: Vincent is over him +0.45, he never touched him (an insult to be warned off) -0.3, caution +0.17; against refuse 0.27]
day 20: Frankie Moretti tells Vincent Fontana he'll leave Peter Orsini alone, and does not mean it  [violate 0.64: what breaking an order costs -0.35, his grudge against Peter +0.33, volatility +0.26; against obey 0.45] (not honest)
day 34: Vincent Fontana believes Frankie Moretti went against his order: discipline  [discipline 0.76: an order is an order +0.35, volatility +0.3, pride +0.11; against rebuke 0.17]
```

## Seed 19. A plan changed by what he learnt: Georgie Leone

```
day 0: Georgie Leone starts a pursuit: make Joey Ricci leave him alone
day 2: Georgie Leone weighs what to do about Joey Ricci: intercessor (Vincent Palumbo) 0.6, intercessor (Joey DeSantis) 0.54, askAround 0.2, pay 0.04, endure 0.03
day 3: Georgie Leone: going to Vincent Palumbo came to nothing; he thinks again
day 3: Georgie Leone weighs what to do about Joey Ricci: intercessor (Joey DeSantis) 0.55, askAround 0.2, endure 0.03
day 4: Georgie Leone: going to Joey DeSantis came to nothing; he thinks again
day 4: Georgie Leone weighs what to do about Joey Ricci: askAround 0.2, endure 0.03
day 4: Georgie Leone asks Vincent Palumbo who Joey Ricci answers to: unknown  [unknown 0.21: trust in Georgie +0.25]
day 5: Georgie Leone weighs what to do about Joey Ricci: askAround 0.2, endure 0.03
day 5: Georgie Leone asks Joey DeSantis who Joey Ricci answers to: tell  [tell 1.16: he knows +1, trust in Georgie +0.2]
day 5: Georgie Leone now believes Joey Ricci answers to Sonny Amato (Joey DeSantis told him); he will think again
day 6: Georgie Leone weighs what to do about Joey Ricci: chair (Sonny Amato) 0.06, endure 0.03
day 6: Georgie Leone changes his plan: askAround (Joey DeSantis) → chair (Sonny Amato), because he now believes Joey Ricci answers to Sonny Amato
day 7: Georgie Leone: going to Sonny Amato came to nothing; he thinks again
day 7: Georgie Leone weighs what to do about Joey Ricci: endure 0.03
```

## Seed 19. A lie: Nicky Conti to Lenny Gallo

```
day 76: Lenny Gallo starts a pursuit: find out who was behind Gallo's Candy Store was robbed of $358.
day 78: Lenny Gallo asks Joey Rizzo who was behind it: unknown  [unknown -0.02: caution -0.12, trust in Lenny +0.1]
day 79: Lenny Gallo asks Sonny Cassano who was behind it: unknown  [unknown 0.04: trust in Lenny +0.12, caution -0.08]
day 80: Lenny Gallo asks Sonny Pellegrino who was behind it: unknown  [unknown 0.08: trust in Lenny +0.14, caution -0.05]
day 81: Lenny Gallo asks Nicky Conti who was behind it: withhold (not the truth)  [withhold 0.95: he knows who +1, caution -0.15, trust in Lenny +0.1] (not honest)
day 82: Lenny Gallo asks Ralphie Barone who was behind it: unknown  [unknown -0.01: caution -0.11, trust in Lenny +0.1]
day 83: Lenny Gallo asks Eddie Testa who was behind it: unknown  [unknown 0.04: trust in Lenny +0.1, caution -0.06]
day 84: Lenny Gallo asks Teddy Valenti who was behind it: unknown  [unknown 0: trust in Lenny +0.17, caution -0.17]
day 85: Lenny Gallo asks Teddy Leone who was behind it: unknown  [unknown -0.04: caution -0.14, trust in Lenny +0.1]
day 86: Lenny Gallo asks Carmine Conti who was behind it: unknown  [unknown 0: trust in Lenny +0.1, caution -0.1]
```

## Seed 19. A promise weighed day by day: Hank Lupo

```
day 31: Hank Lupo starts a pursuit: do what he promised (o180)
day 32: Hank Lupo, on his promise to Peter Orsini (6 days left): delay  [delay 0.26: there is time +0.25; against abandon 0.22]
day 33: Hank Lupo, on his promise to Peter Orsini (5 days left): delay  [delay 0.26: there is time +0.25; against abandon 0.22]
day 34: Hank Lupo, on his promise to Peter Orsini (4 days left): delay  [delay 0.26: there is time +0.25; against abandon 0.22]
day 35: Hank Lupo, on his promise to Peter Orsini (3 days left): act  [act 0.32: he gave his word (agreeable) +0.23, what it will cost him -0.17, the deadline +0.15; against delay 0.26]
day 35: Hank Lupo has what he wanted: do what he promised (o180) (he took it to Vincent Fontana)
```

