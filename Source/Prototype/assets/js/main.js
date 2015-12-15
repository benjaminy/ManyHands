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
var selected_team_data;
var self_user;

document.getElementById("team_create").onclick = handleTeamCreate;
document.getElementById('teammate_add').onclick = handleTeammateAdd;
document.getElementById('save_data').onclick = handleSaveData;
document.getElementById('v2_call').onclick = makeV2Call;
document.getElementById('get_teammate_db').onclick = getTeammateDB;

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
		self_user = sessionStorage.getItem('self_user');
		setLoggedUser();
		getTeamList();
		getPrivKey();
	}
}

function setLoggedUser(){
	var text = document.getElementById('logged_user');
	text.innerHTML = "Logged in as: "+self_user;

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

function handleSaveData(evt){
	saveData();
}

function saveData(){
	var team_data = JSON.stringify(selected_team_data);

	var data = forge.util.createBuffer(team_data);
	var iv = "0000000000000000"

	var userTeamKey = localStorage.getItem(selected_team+'_userTeamKey')
	console.log('userteamkey: ', userTeamKey);
	var data_cipher = forge.aes.startEncrypting(userTeamKey, iv);

	data_cipher.update(data);

	var status = data_cipher.finish();

	var encrypted_data = data_cipher.output.data;

	fileUploadRequest(encrypted_data, selected_team+'/data', onTeamDataUpload);
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

	getTeamSalt(selected_team);
}

function getTeamSalt(team_name){
	var xmlhttp = new XMLHttpRequest();
	xmlhttp.team_name = team_name;
	xmlhttp.addEventListener('load', onTeamSaltRx, false)

	xmlhttp.open('GET', "https://content.dropboxapi.com/1/files/auto/"+team_name+"/team_salt", true);
	xmlhttp.setRequestHeader("Authorization"," Bearer "+access_token);
	xmlhttp.send(null);
}

function onTeamSaltRx(){
	var encrypted_teamsalt = this.responseText;

	var pbkd = forge.pkcs5.pbkdf2(combo, userSalt, 40, 16);

	var iv = "0000000000000000";

	var team_salt = forge.aes.startDecrypting(pbkd, iv);

	var new_buffer = forge.util.createBuffer(encrypted_teamsalt);

	team_salt.update(new_buffer);

	var status = team_salt.finish();

	var plaintext = team_salt.output.data;
	var actual_salt = plaintext.split('team_salt: ')[1];


	sessionStorage.setItem(this.team_name+'_salt', actual_salt);


	makeDownloadRequest("/"+this.team_name+'/data', onTeamDataRx);

}

function onTeamDataRx(){
	var encrypted_data = this.responseText;
	text_field.value = encrypted_data;
	var team_name = selected_team;
	if(!localStorage.getItem(team_name+'_userTeamKey')){
		console.log("userTeamKey Not found")
		var team_salt = sessionStorage.getItem(team_name+'_salt');
		var pbkd = forge.pkcs5.pbkdf2(combo, userSalt, 40, 16);

		var userTeamKey = forge.pkcs5.pbkdf2(encrypted_privkey, team_salt, 40, 16);
		localStorage.setItem(team_name+'_userTeamKey', userTeamKey);
	}

	else{
		var userTeamKey = localStorage.getItem(team_name+'_userTeamKey');	
	}
	console.log(userTeamKey)
	var iv = "0000000000000000";
	var data = forge.aes.startDecrypting(userTeamKey, iv);
 	var new_buffer = forge.util.createBuffer(encrypted_data);   
   	data.update(new_buffer);  
   	var status = data.finish();
   	var plain_data = data.output.data;
   	console.log(plain_data);
   	var data = JSON.parse(plain_data);

   	selected_team_data = data;
   	
   	console.log(selected_team_data);

   	text_field.value = data['data'];


   	populateTeammateList(selected_team_data);
}


function populateTeammateList(data){
	member_list = data['team_members'];

	var teammate_list = document.getElementById('teammate_list')
	teammate_list.innerHTML = "";

	var list = document.createElement('ul');

	for(var i = 0; i < member_list.length; i++){
		var item = document.createElement('li');
		item.appendChild(document.createTextNode(member_list[i]));
		list.appendChild(item);
	}

	teammate_list.appendChild(list);
}

function getTeammateDB(){
	var teammate_uid = member_list[1];

}


function handleTeamCreate(e){
	var team_name = document.getElementById('team_name').value;
	selected_team = team_name;

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
	console.log('Folder created: ' + team_name);

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
	var team_data = JSON.stringify({'team_members': ['none'], 'data': 25});
	var data = forge.util.createBuffer(team_data);
	var iv = "0000000000000000"

	var userTeamKey = localStorage.getItem(team_name+'_userTeamKey')

	var data_cipher = forge.aes.startEncrypting(userTeamKey, iv);

	data_cipher.update(data);

	var status = data_cipher.finish();

	var encrypted_data = data_cipher.output.data;

	fileUploadRequest(encrypted_data, team_name+'/data', onTeamDataInitialize);
}


function onTeamDataInitialize(){
	var resp = JSON.parse(this.responseText);
	var path = resp['path'];

	getPubLink(path, updateTeamKeyLinks, onTeamLinksDataRx)
}

function onTeamDataUpload(){
	if(this.status == 200){
		console.log("data file uploaded")
	}
}

function onTeamLinksDataRx(){
	var resp = this.responseText
	var link_update = resp.concat("Data: "+this.publink+"\n");
	var path = this.path;
	var team_name = path.split('/')[1]

	fileUploadRequest(link_update, team_name+"/links", onTeamDataLinkUpdate);

}

function onTeamDataLinkUpdate(){
	console.log("Team data link updated")
}

//Create User Key for team data
function makeUserTeamKey(team_salt, team_name){
	var pbkd = forge.pkcs5.pbkdf2(combo, userSalt, 40, 16);

	var userTeamKey = forge.pkcs5.pbkdf2(encrypted_privkey, team_salt, 40, 16);
	localStorage.setItem(team_name+'_userTeamKey', userTeamKey);

	console.log("userTeamKey created: "+ team_name);

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

		xmlhttp.addEventListener('load', onTeamDirPublinkRx, false);

		xmlhttp.open('POST', "https://api.dropbox.com/1/shares/auto"+path+"?short_url=false", true);
		xmlhttp.setRequestHeader("Authorization"," Bearer "+access_token);
		xmlhttp.send(null);
		// updateTeamLinks(path);
	} 
}

function onTeamDirPublinkRx(){
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

	var team_links_list = resp.split('\n');

	console.log(team_links_list);

	for(var i = 0; i < team_links_list.length; i++){
		var team_info = team_links_list[i];
		console.log(team_info.indexOf(this.team_name));
		if (team_info.indexOf(this.team_name)>=0){
			team_links_list.splice(i, 1);
			console.log(team_links_list);
		}
	}

	var link_update = this.team_name+": "+this.team_publink;

	team_links_list.push(link_update);

	var list_string = team_links_list.toString();

	var links_string = list_string.replace(/,/g, '\n');
	
	fileUploadRequest(links_string, "/team_links", onTeamLinksUpdate);
	
}

function onTeamLinksUpdate(){
	if (this.status == 200){
		console.log('Team links updated');
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
	console.log('Key for '+selected_user+' created');

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

		getPubLink(path, updateTeamKeyLinks, onTeammateLinksRx);
	} 
}

function updateTeamKeyLinks(){
	if(this.status == 200){
		var resp = JSON.parse(this.responseText);
		var publink = resp.url.replace("www.dropbox.com", "dl.dropboxcontent.com");

		var xmlhttp = new XMLHttpRequest();
		xmlhttp.publink = publink;
		xmlhttp.path = this.path;

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
	// console.log(this.responseText);
	updateMemberData();
}

function updateMemberData(){
	// console.log(selected_team_data);
	selected_team_data['team_members'].push(selected_user);
	console.log("team_data updated");
	saveData();
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
	xmlhttp.path = path;

	xmlhttp.open("POST", "https://api.dropbox.com/1/shares/auto/"+path,true);
	xmlhttp.setRequestHeader("Authorization"," Bearer "+access_token);
	xmlhttp.send(null);
}

function downloadFileCallBack(httpResponse){
	console.log(httpResponse);
}
