const express=require("express"),db=require("../db"),{requireAuth,requireRole}=require("../auth");
const router=express.Router();router.use(requireAuth,requireRole("retailer"));
router.get("/wallet",async(req,res,next)=>{try{const q=await db.query("SELECT balance_paise FROM wallets WHERE user_id=$1",[req.user.sub]);res.json({balance:q.rows[0]?Number(q.rows[0].balance_paise)/100:0,currency:"INR"});}catch(e){next(e);}});
router.get("/transactions",async(req,res,next)=>{try{const q=await db.query("SELECT id,transaction_type,amount_paise,status,reference,description,created_at FROM transactions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100",[req.user.sub]);res.json({transactions:q.rows});}catch(e){next(e);}});
router.post("/recharge",(_req,res)=>res.status(501).json({error:"Recharge provider is not configured. No recharge was submitted or charged."}));
module.exports=router;
