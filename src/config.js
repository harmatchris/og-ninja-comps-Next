import firebase from 'firebase/compat/app';
import 'firebase/compat/database';

const FB_CFG = {
  apiKey: "AIzaSyBQPi4f2qWg3xA65hLL7IpxOiq3kzVk5ls",
  authDomain: "ninja-hq-chris.firebaseapp.com",
  databaseURL: "https://ninja-hq-chris-default-rtdb.firebaseio.com",
  projectId: "ninja-hq-chris",
  storageBucket: "ninja-hq-chris.firebasestorage.app",
  messagingSenderId: "811964168411",
  appId: "1:811964168411:web:f49a87b1bdcb6aaebf74fe"
};

if (!firebase.apps.length) firebase.initializeApp(FB_CFG);
export const db = firebase.database();

export const fbSet = (p, v) => db.ref(p).set(v);
export const fbUpdate = (p, v) => db.ref(p).update(v);
export const fbRemove = (p) => db.ref(p).remove();

export const IGN_CATS=[
  {id:'bam',name:{de:'Bambinis 5–7',en:'Bambinis 5–7'},color:'#FF6B6B'},
  {id:'km1',name:{de:'Kids M LK1',en:'Kids M LC1'},color:'#0A84FF'},
  {id:'km2',name:{de:'Kids M LK2',en:'Kids M LC2'},color:'#32ADE6'},
  {id:'kw1',name:{de:'Kids W LK1',en:'Kids F LC1'},color:'#FF2D78'},
  {id:'kw2',name:{de:'Kids W LK2',en:'Kids F LC2'},color:'#FF6CAB'},
  {id:'tm1',name:{de:'Teens M LK1',en:'Teens M LC1'},color:'#30D158'},
  {id:'tm2',name:{de:'Teens M LK2',en:'Teens M LC2'},color:'#5DCA7E'},
  {id:'tw1',name:{de:'Teens W LK1',en:'Teens F LC1'},color:'#BF5AF2'},
  {id:'tw2',name:{de:'Teens W LK2',en:'Teens F LC2'},color:'#DA8FFF'},
  {id:'am1',name:{de:'Adults M LK1',en:'Adults M LC1'},color:'#FF5E3A'},
  {id:'am2',name:{de:'Adults M LK2',en:'Adults M LC2'},color:'#FF8C69'},
  {id:'aw1',name:{de:'Adults W LK1',en:'Adults F LC1'},color:'#FF9F0A'},
  {id:'aw2',name:{de:'Adults W LK2',en:'Adults F LC2'},color:'#FFCC02'},
  {id:'msm',name:{de:'Masters 40+ M',en:'Masters 40+ M'},color:'#64D2FF'},
  {id:'msw',name:{de:'Masters 40+ W',en:'Masters 40+ F'},color:'#5AC8FA'},
];

export const MODES = {classic:{id:'classic',name:{de:'Classic',en:'Classic'}},lives:{id:'lives',name:{de:'Extra Life',en:'Extra Life'}}};
export const STAGE_LETTERS = ['A','B','C','D','E','F','G','H'];
export const DEF_OBS = [{id:'o1',name:'Warped Wall',isCP:true,order:0},{id:'o2',name:'Quintuple Steps',isCP:true,order:1},{id:'o3',name:'Spider Flip',isCP:true,order:2},{id:'o4',name:'Rolling Log',isCP:true,order:3},{id:'o5',name:'Cannonball Alley',isCP:true,order:4},{id:'o6',name:'Cargo Net',isCP:true,order:5},{id:'o7',name:'Lache Leap',isCP:true,order:6},{id:'o8',name:'Mega Wall',isCP:true,order:7}];
