var APP_KEY = "rwovrjf7g18ya3b";

document.getElementById("dropbox_connect").onclick = handleAuthClick;
var login_form = document.getElementById("login_form");
var submit_button = document.getElementById("submit_button");

var encryptedToken;
var userSalt;
var uid;
var pass;
var token;



function handleAuthClick(e){
    window.open('https://www.dropbox.com/1/oauth2/authorize?client_id='+encodeURIComponent(APP_KEY)+'&response_type=token&redirect_uri='+encodeURIComponent(get_redirect_uri()), "_self");
}

function get_redirect_uri(){
	return "http://localhost:8080/register.html";
}

submit_button.onclick = function (evt){
	evt.preventDefault();
	onLoginSubmit();
}

function onLoginSubmit(){
	uid = document.getElementById('login_username').value;
	pass = document.getElementById('decrypt_pass').value;

	var param = "uid="+encodeURIComponent(uid);

	var xmlhttp = new XMLHttpRequest();

	xmlhttp.addEventListener("load", onTLDLinkRx, false);

	xmlhttp.open("POST", "login", true);
	xmlhttp.send(param);
}

function onTLDLinkRx(){
	var json = JSON.parse(this.responseText);
	var TLDLink = json.publink;

	downloadTLDFile(TLDLink);
}

function downloadTLDFile(link){
	var xmlhttp = new XMLHttpRequest();

	xmlhttp.addEventListener("load", onTLDRx, false);

	xmlhttp.open("GET", link, true);
	xmlhttp.send(null);
}

function onTLDRx(){
	var TLDResponse = this.responseText;
	var responseArray = TLDResponse.split("\n");


	var accessTokenLink = {link : responseArray[1], name: "accessTokenLink"};
	var userSaltLink = {link : responseArray[2], name: "userSaltLink"};

	var links = [accessTokenLink, userSaltLink]

	downloadLinks(links, onFileRx, onAllFileRx);
}

function downloadLinks(links, every_cb, all_cb){
	var total = links.length;
	var counter = {count: 0, total: total};

	for(var i = 0; i<total; i++){
		var link = links[i];
		var xmlhttp = new XMLHttpRequest();
		xmlhttp.counter = counter;
		xmlhttp.every_cb = every_cb;
		xmlhttp.all_cb = all_cb;
		xmlhttp.link = link;

		xmlhttp.addEventListener("load", function(){
			this.counter.count++;
			this.every_cb(this);
			if(this.counter.count === this.counter.total){
				this.all_cb();
			}
		}, false);

		xmlhttp.open("GET", link.link, true);
		xmlhttp.send(null);
	}

}

function onFileRx(xhr){
	if(xhr.link.name === "accessTokenLink"){
		encryptedToken = xhr.responseText;
	}

	if(xhr.link.name === "userSaltLink"){
		userSalt = xhr.responseText;
		sessionStorage.setItem('user_salt', userSalt);
	}

}

function onAllFileRx(){
	var combo = pass.concat(uid);

	sessionStorage.setItem('combo', combo);

	var pbkd = forge.pkcs5.pbkdf2(combo, userSalt, 40, 16);

	var iv = "0000000000000000";
	var accessToken = forge.aes.startDecrypting(pbkd, iv);
   
 	var new_buffer = forge.util.createBuffer(encryptedToken);   
   	accessToken.update(new_buffer);  
   	var status = accessToken.finish();
   	var plaintext = accessToken.output.data;

   	if(plaintext.indexOf("accessToken: ") === 0){
   		console.log("success");
   		var split = plaintext.split('accessToken: ')
   		var token = split[1];
   		sessionStorage.setItem('combo', combo);
   		sessionStorage.setItem('userSalt', userSalt);
   		sessionStorage.setItem('self_user', uid);
   		onLoginSuccess(token);
   	}
   	else{
   		console.log("Something went terribly awry with decryption");
   	}
}


function onLoginSuccess(token){
	sessionStorage.setItem('access_token', token);
	window.location.href = "Prototype.html";
}

function downloadEncryptedToken(link){
	var xmlhttp = new XMLHttpRequest();

	xmlhttp.addEventListener('load', onTokenRx, false);

	xmlhttp.open("GET", link, true);
	xmlhttp.send(null);
}


function downloadFile(download_url, cb){
	var xmlhttp = new XMLHttpRequest();
	xmlhttp.onreadystatechange = makeFooCB(cb);

	xmlhttp.open("GET", publicLink, true);
	xmlhttp.send(null)
}

function makeDownloadRequest(filename1, cb){
	var xmlhttp = new XMLHttpRequest();
	//filename = filename1;
	xmlhttp.onreadystatechange = makeFooCB(cb);

	xmlhttp.open("GET", "https://api-content.dropbox.com/1/files/auto/"+filename1+"", true);
	xmlhttp.setRequestHeader("Authorization"," Bearer "+access_token);
	xmlhttp.send(null);

}

function foo(xhr, cb){
	if(xhr.readyState == 4 && xhr.status==200){
		cb(xhr.responseText);
	}
}


function makeFooCB(cb){
	return function(ev){
		foo(this, cb);
	}
}
