// Loads the Users page functions of index.html in a sandbox for tests.
const fs=require('node:fs');
const vm=require('node:vm');

const html=fs.readFileSync('index.html','utf8');
const between=(start,end)=>{const from=html.indexOf(start),to=html.indexOf(end,from);if(from<0||to<0)throw new Error(`block not found: ${start}`);return html.slice(from,to);};
const usersBlock=between('function usersRoleValues(','function populateHotelCheckboxes(');
const saveBlock=between('async function saveUserEdit(','async function submitUser(');
const appText=html.match(/function appText\([\s\S]*?\r?\n\}/)[0];
const esc=html.match(/function esc\(s\)\{.*?\}(?=\r?\n)/)[0];

function loadUsersPage(globals={}){
  const context=vm.createContext({console:{error(){},warn(){}},currentUser:null,DEMO_USERS:[],searchQ:'',window:{},...globals});
  vm.runInContext(`${appText}\n${esc}\n${usersBlock}\n${saveBlock}`,context);
  return context;
}
module.exports={html,loadUsersPage};
