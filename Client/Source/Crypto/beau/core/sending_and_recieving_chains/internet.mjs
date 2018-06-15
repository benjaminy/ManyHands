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
    };
    u.send = function(user_from, user_to, message) {
        u.communication[user_from.name][user_to.name].push(message);
    }
    u.recieve_all = function(user_from, user_to) {
        let output = u.communication[user_from.name][user_to.name];
        u.communication[user_from.name][user_to.name] = [];
        return output;
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
    i.add_user(alice);
    i.add_user(bob);
    i.add_user(eve);
    console.log(i.communication);
    i.send(alice, bob, "Hey bob!");
    i.send(alice, bob, "How are you doing?");
    i.send(alice, bob, "its been quite a long time there");
    console.log(i.recieve_all(alice, bob));


}

main();
