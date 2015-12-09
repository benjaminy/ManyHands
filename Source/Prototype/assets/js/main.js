var APP_KEY = "rwovrjf7g18ya3b";

//create team:
	//Make team folder on the cloud. Populate with keys.
//Add teammates:
	//Create keys for teammate.

//document.getElementById("submit").onclick = readFile;
var fileName="";
// var team_select 
var selected_team;
var selected_user;
var encrypted_privkey;
var access_token = "";
var combo = "";

document.getElementById("team_create").onclick = handleTeamCreate;
document.getElementById('teammate_add').onclick = handleTeammateAdd;
document.getElementById('v2_call').onclick = makeV2Call;

var text_field = document.getElementById('text_data');

var team_list = document.getElementById("team_list")
team_list.onchange = handleTeamSelect;


var username_field = document.getElementById('teammate_name');



// var encryptedPrivKey = localStorage.getItem('encrypted_privkey');
var userSalt = sessionStorage.getItem('userSalt');

window.onload = checkAuth;


function makeV2Call(){
	var xmlhttp = new XMLHttpRequest();
	var data = {path: ""}
	var requestData = JSON.stringify(data);

	console.log(requestData);

	xmlhttp.addEventListener('load', function(){
		console.log(this.responseText)}, false);

	xmlhttp.open('POST', 'https://api.dropboxapi.com/2/sharing/get_shared_links', true);
	xmlhttp.setRequestHeader('Authorization', ' Bearer '+access_token);
	xmlhttp.setRequestHeader('Content-Type', ' application/json ');
	xmlhttp.send(requestData)

}

function parseqs(text){
	var split = text.split('&');
	var params = {};
	for(var i=0; i<split.length; i++){
		var kv = split[i].split('=',2);
		params[kv[0]] = kv[1];
	}
	return params;
}

// if(window.location.hash){

// 	var params = parseqs(window.location.hash.substring(1));
// 	if(params.error){
// 		document.write("Error "+params.error+": "+params.error_description.replace(/\+/g,' '));
// 	}
// 	else{
// 		access_token = parseqs(window.location.hash.substring(1)).access_token;
// 		window.location.hash = "";
// 		sessionStorage.setItem('access_token', access_token);
// 	}
// }



function checkAuth(evt){
	if(!sessionStorage.getItem('access_token')){
		alert("Please log in again");
	}

	else{
		access_token = sessionStorage.getItem('access_token');
		combo = sessionStorage.getItem('combo');
		getTeamList();
		getPrivKey();
	}
}

function getPrivKey(){
	var xmlhttp = new XMLHttpRequest();

	xmlhttp.addEventListener('load', onPrivKeyRx, false);
	xmlhttp.open("GET", "https://api-content.dropbox.com/1/files/auto/privKey", true);
	xmlhttp.setRequestHeader("Authorization"," Bearer "+access_token);
	xmlhttp.send(null);
}

function onPrivKeyRx(){
	encrypted_privkey = this.responseText;
	sessionStorage.setItem('encrypted_privkey', encrypted_privkey);
	// var pbkd = forge.pkcs5.pbkdf2(sessionStorage.getItem('combo'), userSalt, 40, 16);
	// privKey = forge.pki.decryptRsaPrivateKey(enc_priv_key, pbkd);	
}

function get_redirect_uri(){
	return "http://localhost:8080/Prototype.html";
}

function handleTeammateAdd(evt){
	var username = username_field.value;
	checkUserDB(username);

}

//Get list of teams
function getTeamList(){
	var xmlhttp = new XMLHttpRequest();
	var data = {path: ""}
	var requestData = JSON.stringify(data);

	xmlhttp.addEventListener('load', onTeamListRx, false);

	xmlhttp.open('POST', 'https://api.dropboxapi.com/2/files/list_folder', true);
	xmlhttp.setRequestHeader('Authorization', ' Bearer '+access_token);
	xmlhttp.setRequestHeader('Content-Type', ' application/json ');
	xmlhttp.send(requestData)
}

//Parse team list
function onTeamListRx(){
	var response = JSON.parse(this.responseText);
	var team_list = [];
	var list = response['entries'];
	
	for(var i = 0; i<list.length; i++){
		if(list[i]['.tag'] === 'folder'){
			team_list.push(list[i]['name']);
		}
	}

	populateTeamSelect(team_list);
}

//Populate team selection dropdown
function populateTeamSelect(list){
	// team_select = document.getElementById('team_list');
	// team_select.innerHTML = ' ';
	var data = ""
	for(var i = 0; i<list.length; i++){
		var option = document.createElement("option");
		option.text = list[i];
		team_list.appendChild(option)
	}
	//team_select.innerHTML(data);
}

function handleTeamSelect(evt){
	selected_team = team_list.options[team_list.selectedIndex].text;
	var body = document.getElementById('team_selected');

	body.innerHTML = "";

	body.innerHTML = "Selected Team: "+ selected_team+"<br>";

	getTeammateList(selected_team);
	getTeamData(selected_team);
}

function getTeamData(team_name){
	var xmlhttp = new XMLHttpRequest();

	xmlhttp.addEventListener('load', onTeamDataRx, false)

	xmlhttp.open()
}

function getTeammateList(selected_team){
	var xmlhttp = new XMLHttpRequest();

	xmlhttp.addEventListener('load', onTeammateListRx, false);

	xmlhttp.open('GET', 'https://api.dropboxapi.com/1/metadata/auto/'+selected_team+'/Keys/', true);
	xmlhttp.setRequestHeader("Authorization"," Bearer "+access_token);
	xmlhttp.send(null);
}

function onTeammateListRx(){
	var resp = JSON.parse(this.responseText);
	var folder_contents = resp['contents'];
	var teammate_list = [];
	for(var i = 0; i< folder_contents.length; i++){
		var path = folder_contents[i]['path'];
		teammate_list.push(path.split('/')[3]);
	}
		
	var list = document.createElement('ul');

	for(var i = 0; i < teammate_list.length; i++){
		var item = document.createElement('li');
		item.appendChild(document.createTextNode(teammate_list[i]));
		list.appendChild(item);
	}

	document.getElementById('teammate_list').appendChild(list);
}


function handleTeamCreate(e){
	var team_name = document.getElementById('team_name').value;

	createTeamFolder(team_name);

}


//Create team folder
function createTeamFolder(team_name){
	var xmlhttp = new XMLHttpRequest();
	var data = team_name+'/Keys'

	xmlhttp.addEventListener('load', onTeamFolderCreate, false);

	xmlhttp.open('POST', 'https://api.dropboxapi.com/1/fileops/create_folder?root=auto&path='+data, true);
	xmlhttp.setRequestHeader('Authorization', ' Bearer '+access_token);
	xmlhttp.send();
}

//Create and upload team salt
function onTeamFolderCreate(){
	//Once folder is created make salt and upload it to the folder.
	var folder_metadata = JSON.parse(this.responseText);
	var path = folder_metadata.path;
	var team_name = path.split('/')[1];

	var team_salt = forge.random.getBytesSync(128);

	var uteam_salt = forge.util.createBuffer("team_salt: "+team_salt);

	var pbkd = forge.pkcs5.pbkdf2(combo, userSalt, 40, 16);


	var iv = "0000000000000000";

	var team_salt_cipher = forge.aes.startEncrypting(pbkd, iv);
	team_salt_cipher.update(uteam_salt);
	var status = team_salt_cipher.finish();

	var encrypted_team_salt = team_salt_cipher.output.data;

	fileUploadRequest(encrypted_team_salt, team_name+"/team_salt", teamSaltCallback);
	fileUploadRequest("", team_name+"/links", getTeamDirPublink);

	sessionStorage.setItem(team_name+"_salt", team_salt);

	makeUserTeamKey(team_salt, team_name);

}

function initializeEncryptedDB(team_name){
	var data = forge.util.createBuffer("Team data created \n";
	var iv = "0000000000000000"

	var userTeamKey = localStorage.getItem(team_name+'_userTeamKey')

	var data_cipher = forge.aes.startEncrypting(userTeamKey, iv);

	data_cipher.update(data);

	var status = data_cipher.finish();

	var encrypted_data = data_cipher.output.data;

	fileUploadRequest(encrypted_data, team_name+'/data', onTeamDataUpload);
}


function onTeamDataUpload(){
	var resp = JSON.parse(this.responseText);
	var path = resp['path'];

	getPubLink(path, updateTeamKeyLinks, onTeamLinksDataRx)
}

function onTeamLinksDataRx(){
	var resp = this.responseText
	var link_update = resp.concat("Data: "+this.publink+"\n");

	fileUploadRequest(link_update, selected_team+"/links", onTeammateLinksUpdate);


}

function makeUserTeamKey(team_salt, team_name){
	var pbkd = forge.pkcs5.pbkdf2(combo, userSalt, 40, 16);

	var userTeamKey = forge.pkcs5.pbkdf2(encrypted_privkey, team_salt, 40, 16);
	localStorage.setItem(team_name+'_userTeamKey', userTeamKey);

	initializeEncryptedDB(team_name);

}

function fileUploadRequest(requestData, path, callback){

	var xmlhttp = new XMLHttpRequest();
	var team_name = path.split('/')[1]
	xmlhttp.addEventListener("load", callback, false)

	xmlhttp.open("POST", "https://api-content.dropbox.com/1/files_put/auto/"+path+"?overwrite=true", true);
	xmlhttp.setRequestHeader("Authorization"," Bearer "+access_token);
	xmlhttp.send(requestData);
}

function teamSaltCallback(){
	// 
}

function getTeamDirPublink(){
	if(this.status == 200){
		var resp = JSON.parse(this.responseText);
		var path = resp['path'];
		var team_name = path.split('/')[1]

		var xmlhttp = new XMLHttpRequest();
		xmlhttp.team_name = team_name;

		xmlhttp.addEventListener('load', downloadTeamLinks, false);

		xmlhttp.open('POST', "https://api.dropbox.com/1/shares/auto"+path+"?short_url=false", true);
		xmlhttp.setRequestHeader("Authorization"," Bearer "+access_token);
		xmlhttp.send(null);
		// updateTeamLinks(path);
	} 
}

function downloadTeamLinks(path){
	var resp = JSON.parse(this.responseText);
	var team_publink = resp.url.replace("www.dropbox.com", "dl.dropboxcontent.com");

	var xmlhttp = new XMLHttpRequest();
	xmlhttp.team_publink = team_publink;
	xmlhttp.team_name = this.team_name;

	xmlhttp.addEventListener('load', onTeamLinksRx, false);

	xmlhttp.open('GET', "https://content.dropboxapi.com/1/files/auto/team_links", true);
	xmlhttp.setRequestHeader("Authorization"," Bearer "+access_token);
	xmlhttp.send(null);

}

function onTeamLinksRx(){
	var resp = this.responseText;
	console.log("Team_links: " + resp);

	var link_update = resp.concat(this.team_name+": "+this.team_publink+"\n");

	fileUploadRequest(link_update, "/team_links", onTeamLinksUpdate);
	
}

function onTeamLinksUpdate(){
	if (this.status == 200){
		//
	}
	else{

	}
}

function makeDownloadRequest(filename, cb){
	var xmlhttp = new XMLHttpRequest();
	//filename = filename1;
	xmlhttp.addEventListener('load', cb, false);

	xmlhttp.open("GET", "https://content.dropboxapi.com/2/files/download", true);
	xmlhttp.setRequestHeader("Authorization"," Bearer "+access_token);
	xmlhttp.setRequestHeader("Dropbox-API-Arg", " {\"path\": \""+filename+"\"}")
	xmlhttp.send(null);

}


function checkUserDB(teammate_name){
	var xmlhttp = new XMLHttpRequest();
	var post_data = "uid="+encodeURIComponent(teammate_name);

	xmlhttp.addEventListener('load', onUserStatusRx, false);
	// xmlhttp.teammate_name = teammate_name;

	xmlhttp.open('POST', 'user', true);
	xmlhttp.send(post_data)
}

function onUserStatusRx(){
	//Get uid from here to 
	var body = document.getElementById('user_selected');

	body.innerHTML = "";

	if(this.status==200){
		var resp = JSON.parse(this.responseText)
		console.log(this.responseText);
		selected_user = resp[0]['uid'];

		body.innerHTML = "Selected User: "+resp[0]['uid']+"<br>";
		
		var user_publink = resp[0]['publink']
		downloadFile(user_publink,  userPublinkCB);
		// var team_name = resp[0]['uid']
	}
	else{
		body.innerHTML = "Selected User: NOT FOUND"
	}
}

function userPublinkCB(){
	var resp = this.responseText;
	var user_pubKeylink = resp.split('\n')[0]
	downloadFile(user_pubKeylink, userPubKeyCB);
}

function userPubKeyCB(){
	var pem = this.responseText;
	var teammate_pubKey = forge.pki.publicKeyFromPem(pem);

	makeTeammateKey(teammate_pubKey);

}

//https://github.com/digitalbazaar/forge/issues/274
function makeTeammateKey(teammate_pubkey){
	var userTeamKey = localStorage.getItem(selected_team+"_userTeamKey");
	var encoded_teamkey = btoa(userTeamKey);

	var encrypted_userTeamKey = teammate_pubkey.encrypt(encoded_teamkey);
	console.log(encrypted_userTeamKey);

	uploadTeammateKey(encrypted_userTeamKey);
}


function uploadTeammateKey(encrypted_userTeamKey){
	fileUploadRequest(encrypted_userTeamKey, selected_team+'/Keys/'+selected_user, getTeammateKeyPublink);

}

function getTeammateKeyPublink(){
	if(this.status == 200){
		console.log(selected_user + " added to "+ selected_team);
		var resp = JSON.parse(this.responseText);
		var path = resp['path'];
		var team_name = path.split('/')[1]

		getPubLink(path, updateTeamKeyLinks, onTeammateLinksRx);
	} 
}

function updateTeamKeyLinks(){
	if(this.status == 200){
		var resp = JSON.parse(this.responseText);
		var publink = resp.url.replace("www.dropbox.com", "dl.dropboxcontent.com");

		var xmlhttp = new XMLHttpRequest();
		xmlhttp.publink = publink;

		xmlhttp.addEventListener('load', this.callback, false);

		xmlhttp.open('GET', "https://content.dropboxapi.com/1/files/auto/"+selected_team+"/links", true);
		xmlhttp.setRequestHeader("Authorization"," Bearer "+access_token);
		xmlhttp.send(null);
	}

}

function onTeammateLinksRx(){
	var resp = this.responseText
	var link_update = resp.concat(selected_user+": "+this.publink+"\n");

	fileUploadRequest(link_update, selected_team+"/links", onTeammateLinksUpdate);

}

function onTeammateLinksUpdate(){
	console.log(this.responseText);

}


function downloadFile(download_url, cb){
	var xmlhttp = new XMLHttpRequest();
	xmlhttp.addEventListener('load', cb, false);

	xmlhttp.open("GET", download_url, true);
	xmlhttp.send(null)
}

function readFile(e){
	var contents = "";
	var input_file = document.getElementById("input_file");
	var file_encrypt = input_file.files[0];

	if(input_file.files.length!=1){
		alert('Please select a file.');
		return false;
	}
	var reader = new FileReader();
	reader.onload = function(e){
		contents = reader.result;
		encryptFile(contents);
	}
	fileName = file_encrypt.name;
	reader.readAsBinaryString(input_file.files[0]);

}

function getPubLink(path, cb, cb2){
	var xmlhttp = new XMLHttpRequest();

	xmlhttp.addEventListener('load', cb, false);
	xmlhttp.callback = cb2;

	xmlhttp.open("POST", "https://api.dropbox.com/1/shares/auto/"+path,true);
	xmlhttp.setRequestHeader("Authorization"," Bearer "+access_token);
	xmlhttp.send(null);
}

function downloadFileCallBack(httpResponse){
	console.log(httpResponse);
}
