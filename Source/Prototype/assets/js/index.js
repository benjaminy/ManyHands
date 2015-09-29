var APP_KEY = "rwovrjf7g18ya3b";

document.getElementById("dropbox_connect").onclick = handleAuthClick;
var login_form = document.getElementById("login_form");



function handleAuthClick(e){
    window.open('https://www.dropbox.com/1/oauth2/authorize?client_id='+encodeURIComponent(APP_KEY)+'&response_type=token&redirect_uri='+encodeURIComponent(get_redirect_uri()), "_self");
}

function get_redirect_uri(){
	return "http://localhost:8080/register.html";
}

login_form.onsubmit = function (evt){
	evt.preventDefault();
	onLoginSubmit();
}

function onLoginSubmit(){
	var uid = document.getElementById('login_username').value;
	var pass = document.getElementById('decrypt_pass').value;

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

	var link = responseArray[1];

	downloadEncryptedToken(link);
}

function downloadEncryptedToken(link){
	var xmlhttp = new XMLHttpRequest();

	xmlhttp.addEventListener('load', onTokenRx, false);

	xmlhttp.open("GET", link, true);
	xmlhttp.send(null);
}

function onTokenRx(){
	var response = this.responseText;
	decryptAccessToken(response);
}

function decryptAccessToken(response){
	var iv = localStorage.getItem('iv');
	accessTokenCipher = forge.aes.startDecrypting()
}

function makeDownloadRequest(filename1, cb){
	var xmlhttp = new XMLHttpRequest();
	//filename = filename1;
	xmlhttp.onreadystatechange = makeFooCB(cb);

	xmlhttp.open("GET", "https://api-content.dropbox.com/1/files/auto/"+filename1+"", true);
	xmlhttp.setRequestHeader("Authorization"," Bearer "+access_token);
	xmlhttp.send(null);

}

function downloadFile(download_url, cb){
	var xmlhttp = new XMLHttpRequest();
	xmlhttp.onreadystatechange = makeFooCB(cb);

	xmlhttp.open("GET", publicLink, true);
	xmlhttp.send(null)
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
