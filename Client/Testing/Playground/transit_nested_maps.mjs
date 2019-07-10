#!/usr/bin/env node --experimental-modules

import T from "transit-js";

const a = T.map();

const b = T.map();
b.set("a", 1);
b.set("b", 2);

const c = T.map();
c.set("a", 3);
c.set("b", 4);

/*
for(let i = 0; i < 20; i++){
    a.set(i, "adsfsd");
}
console.log(a);

for(let i = 0; i < 10000; i++){
    a.get(0);
}


console.log(a);
*/

for(let i = 0; i < 200; i++){ // above the size threshold
    a.set(i, "aaaaaaaa");
}

//console.log("A DOT KEYS", a.backingMap._keys.toString());
//console.log("A DOT KdsfasdfaEYS", a.backingMap.map);

a.set(b, 10);
//a.set(c, 20);

//console.log(a.backingMap._keys.toString(), "are the ekys");

//console.log("A DOT KEYS2", a.backingMap._keys.toString());
//console.log("A DOT KdsfasdfaEYS", a.backingMap.map);

//console.log("BEFORE CONSOLIDATION")

//console.log("a, tostring", a, a.backingMap._keys.toString());

//for(const [k, v] of a){
//    console.log("key:", k.toString(), "value:", v);
//}

//for(let i = 0; i < 10000; i++){
//    a.get(b);
//}
//a.set(c, 20);

// console.log("AFTER CONSOLIDATION")
// 
// console.log(a, a.toString());

let counter = 0;
for(const [k, v] of a){
    counter++;
    console.log("key:", k.toString(), "value:", v);
}

console.log("worked? " + counter, counter === 201);

