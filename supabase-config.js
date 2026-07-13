export default function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
  return res.status(200).json({
    url:process.env.SUPABASE_URL||'',
    anonKey:process.env.SUPABASE_ANON_KEY||'',
    configured:Boolean(process.env.SUPABASE_URL&&process.env.SUPABASE_ANON_KEY)
  });
}
