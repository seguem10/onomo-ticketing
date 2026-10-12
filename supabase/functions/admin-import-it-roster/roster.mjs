export const ROSTER=[
 {prenom:'Hicham',nom:'Nouar',email:'it.lesquare@onomohotel.com',hotel:'Le Square by ONOMO Collection'},
 {prenom:'Martial',nom:'Tonou',email:'it.abidjan@onomohotel.com',hotels:['ONOMO Allure Abidjan Baobab','ONOMO Hotel Abidjan Airport']},
 {prenom:'Paul',nom:'Ighodaro',email:'it.allureabuja@onomohotel.com',hotel:'ONOMO Allure Abuja AATC Hotel'},
 {prenom:'Dramane',nom:'Kanoute',email:'it.bamako@onomohotel.com',hotel:'ONOMO Hotel Bamako'},
 {prenom:'Riad',nom:'Bouizen',email:'it.massira@onomohotel.com',hotel:'CASA CITY CENTER'},
 {prenom:'Abass',nom:'Pouye',email:'it.conakry@onomohotel.com',hotel:'ONOMO Hotel Conakry'},
 {prenom:'Lamine',nom:'Sow',email:'it.dakar@onomohotel.com',hotel:'ONOMO Hotel Dakar'},
 {prenom:'Orest',nom:'Simon Paul',email:'it.daressalaam@onomohotel.com',hotel:'ONOMO Hotel Dar Es Salaam'},
 {prenom:'Olivier',nom:'Kuitcheu',email:'it.douala@onomohotel.com',hotel:'ONOMO Hotel Douala'},
 {prenom:'Eric',nom:'Akakpo',email:'itsupport.lome@onomohotel.com',hotel:'ONOMO Hotel Lomé'},
 {prenom:'Khalil',nom:'Abbad',email:'it.rabat@onomohotel.com',hotel:'ONOMO Hotel Rabat Terminus'},
];
export function accountBody(member,password){
 const regional=Array.isArray(member.hotels)&&member.hotels.length>1;
 return {...member,password,role:regional?'it_regional':'it_hotel',roles:[regional?'it_regional':'it_hotel'],hotel:regional?null:member.hotel,hotels:regional?member.hotels:[]};
}
