# Fantasy soccer auction software

We need to write a software to manage the auction for my fantasy soccer league.

### Words
* player / players: soccer players to buy
* auctioner: who buys
* admin: the one who sets up and runs software
* max-expendable: the max credits an auctioner can spend; formula: *Remaining credits - (Remaining players - 1)*

## Electron / Node language GUI software

### Software key points
* Two files must be read (examples will be at the end):
    1) yaml config file containing auctioners and various configs
	2) csv file containing players to buy
* Status must be saved after every buyed player in a "save" folder.
* Auction will be made with turns, first player must be selected, then proceed with next in config file
* If an auctioner decide to skip must not be not considered for current bid
* Main screen must show remaining time and current player (fixed upper screen); list of buyed player per auctioner with cost and remaning credits and max-expendable
* Use external file for labels, we need to use more languages

### Functioning Flow
1) Admin starts software, software reads yaml config file, csv players file and eventually files in "save" folder
2) Admin select first auctioner (the order is in yaml config file)
3) The auctioner calls a player and admin select it from a text box (use autocomplete)
4) Admin clicks on a "Start" Button, focus the second auctioner (according to config file, if it's the last restart from first) and timer starts countdown
5) Admin has now two options depending on auctioner:
    1) Auctioner calls and say a price, admin insert it and confim. Software selects next auctioner and exclude auctioner from current auction
	2) Auctioner skips. Software select next auctioner
6) When only an auctioner remains or admin push the "Assign" button player assigned to the last auctioner, screens teams and credits are updated and saved to disk then flow restarts from point 2

Probably I forgot something so ask if there are open points.

Also instruct me how to launch software

### Example Config file formats
YAML: 
```
auctioners:
  - num: 1,
    name: "mario"
  - num: 2,
    name: "luigi"
  - num: 3,
    name: "bowser"
countdown: "60 seconds"
credits: 330
```

CSV:
```
NAME;ROLE;TEAM
Lautaro,A,Inter
Svilar,A,Roma
```

** TESTED WITH node -> stable (-> v24.20.0) **

