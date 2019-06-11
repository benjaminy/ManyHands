// https://github.com/cognitect/transit-js/issues/50

import transit from "transit-js";

const my_map = transit.map();
my_map.set(1,2);
my_map.set(3,4);
my_map.set(5,6);
my_map.set(7,8);
my_map.set(9,10);
my_map.set(11,12);
my_map.set(13,14);
my_map.set(15,16);
my_map.set(17,18);
my_map.set(19,20);

function a(v,k){
    for(let i = 0; i < 100; i++){
        my_map.get(1);
    }
    console.log("k, v", k, v);
}

my_map.forEach(a);
