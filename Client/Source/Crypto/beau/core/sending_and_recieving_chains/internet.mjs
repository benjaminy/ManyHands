import {user} from "./user";

import  WebCrypto from "node-webcrypto-ossl";
import TextEncoder from "text-encoding";

const WC = new WebCrypto();
const CS = WC.subtle;


function internet() {
    let u = {};
    u.name = "eve's evil interwebs";
    u.communication = {};
    u.add_user = function(new_user) {
        u.communication[new_user.name] = {};
        for (let user in u.communication) {
            if (user !== new_user.name) {
                u.communication[user][new_user.name] = [];
                u.communication[new_user.name][user] = [];
            }
        }
    }
    return u;
}

async function main() {
    let i = internet();
    let shared_secret = await WC.getRandomValues(new Uint32Array(8));
    let alice = await user("alice", shared_secret);
    let bob = await user("bob", shared_secret);
    let eve = await user("eve", shared_secret);

    console.log(i.name);
    console.log(i.communication);
    i.add_user(alice);
    console.log(i.communication);
    i.add_user(bob);
    console.log(i.communication);
    i.add_user(eve);
    console.log(i.communication);
}

main();
