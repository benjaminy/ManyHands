import  WebCrypto from "node-webcrypto-ossl";
const WC = new WebCrypto();
const CS = WC.subtle;

async function main() {
    let alice = await user("alice");
    let bob = await user("bob");

    let sent_message =  await alice.send_message("mensaje numero uno!");
    let recieved_message = await bob.recieve_message("mensaje numero dos!");

    console.log("SENT MESSAGE");
    console.log(sent_message);
    console.log("RECIEVED MESSAGE");
    console.log(recieved_message);
}

async function user(name) {
    let u = {}
    u.name = name;
    u.send_message = async function(message) {
        return message;
    }
    u.recieve_message = async function(message) {
        return message;
    }
    return u;
}

main();
