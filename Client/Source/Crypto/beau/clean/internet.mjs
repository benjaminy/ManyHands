import  WebCrypto from "node-webcrypto-ossl";
import TextEncoder from "text-encoding";

const WC = new WebCrypto();
const CS = WC.subtle;

export function internet() {
    let u = {};
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
    u.recieve = function(user_from, user_to, message) {
        let message = u.communication[user_from.name][user_to.name].shift();
        return message;
    }
    u.recieve_all = function(user_from, user_to) {
        let output = u.communication[user_from.name][user_to.name];
        u.communication[user_from.name][user_to.name] = [];
        return output;
    }
    return u;
}
