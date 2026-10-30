const express=require('express'),crypto=require('crypto'),fs=require('fs'),path=require('path');
const app=express();app.use(express.json({limit:'2mb'}));app.use(express.static(path.join(__dirname,'public')));
const U=process.env.ADMIN_USER||'admin',P=process.env.ADMIN_PASS||'changeme',S=process.env.SECRET||'dev-secret';
const sign=v=>crypto.createHmac('sha256',S).update(v).digest('hex');
const ok=(a,b)=>{const x=Buffer.from(sign(a)),y=Buffer.from(sign(b));return crypto.timingSafeEqual(x,y)};
function auth(req,res,next){const t=(req.headers['x-token']||'').split('.');
 if(t.length==2&&Date.now()<+t[0]&&ok(t[1],sign(t[0])))return next();res.status(401).json({error:'Unauthorized'})}
let col=null;const F=path.join(__dirname,'data.json');
const rd=()=>{try{return JSON.parse(fs.readFileSync(F))}catch{return[]}};
const wr=d=>fs.writeFileSync(F,JSON.stringify(d));
async function list(){return col?col.find({},{projection:{_id:0}}).sort({date:-1}).toArray():rd().sort((a,b)=>b.date-a.date)}
const bad=g=>!g.title||![g.link,g.link2].some(l=>/^https?:\/\//.test(l))||[g.link,g.link2].some(l=>l&&!/^https?:\/\//.test(l));
const clean=b=>({title:String(b.title||'').slice(0,120),desc:String(b.desc||'').slice(0,1000),image:/^(https?:\/\/|data:image\/jpeg;base64,)/.test(b.image||'')?String(b.image).slice(0,400000):'',
 link:String(b.link||'').slice(0,1000),link2:String(b.link2||'').slice(0,1000),category:String(b.category||'General').slice(0,40),size:String(b.size||'').slice(0,30)});
app.get('/api/games',async(_,r)=>r.json(await list()));
app.post('/api/login',(req,res)=>{const{user,pass}=req.body||{};
 if(user===U&&pass===P){const e=String(Date.now()+864e5*7);return res.json({token:e+'.'+sign(e)})}
 res.status(401).json({error:'Wrong login'})});
app.post('/api/games',auth,async(req,res)=>{const g={...clean(req.body),id:crypto.randomUUID(),date:Date.now()};
 if(bad(g))return res.status(400).json({error:'Title and valid link required'});
 if(col)await col.insertOne({...g});else wr([...rd(),g]);res.json(g)});
app.put('/api/games/:id',auth,async(req,res)=>{const g=clean(req.body);
 if(bad(g))return res.status(400).json({error:'Title and valid link required'});
 if(col)await col.updateOne({id:req.params.id},{$set:g});else wr(rd().map(x=>x.id===req.params.id?{...x,...g}:x));res.json({ok:1})});
app.delete('/api/games/:id',auth,async(req,res)=>{
 if(col)await col.deleteOne({id:req.params.id});else wr(rd().filter(x=>x.id!==req.params.id));res.json({ok:1})});
(async()=>{if(process.env.MONGODB_URI){const{MongoClient}=require('mongodb');
 col=(await MongoClient.connect(process.env.MONGODB_URI)).db('gamesite').collection('games');console.log('MongoDB connected')}
 app.listen(process.env.PORT||3000,()=>console.log('Running'))})();
