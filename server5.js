// express 설정
const express = require('express');
const app = express();
const path = require('path');
const QRCode = require('qrcode');
const bodyParser = require('body-parser');
const methodOverride = require('method-override')
const bcrypt = require('bcrypt')
require('dotenv').config()

const ADMIN_USERNAME = process.env.adminUSERNAME; // 관리자 아이디
const ADMIN_PASSWORD = process.env.adminPASSWORD; // 관리자 비밀번호

// passport 라이브러리 설정
const session = require('express-session')
const passport = require('passport')
const LocalStrategy = require('passport-local')
const MongoStore = require('connect-mongo')


app.use(session({
  secret: process.env.SESSION_SECRET, // 나만의 비번 넣기, 세션문자열같은거 암호화할 때 쓰는데 긴게 좋음. 털리면 인생끝남 
  resave : false, // 유저가 요청 날릴 때마다 session 데이터를 다시 갱신할건지 여부(false추천)
  saveUninitialized : false, // 유저가 로그인 안해도 세션을 저장해둘지 여부(false 추천)
  cookie : { maxAge : 60 * 60 * 1000, httpOnly: true },
  store : MongoStore.create({
    mongoUrl : process.env.DB_URL
    ,dbName : 'busapp'
  })
}))
app.use(passport.initialize())
app.use(passport.session()) 

// views 디렉토리를 정적 파일로 제공
app.use(express.static('views'));

app.use(bodyParser.json());
app.use(express.static('public'));

app.use((err,req,res,next) => {
  console.error(err.stack);
  res.status(500).send('서버 에러');
})





// MongoDB연결
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = process.env.DB_URL;

// EJS 템플릿 엔진 설정
app.use(methodOverride('_method')) // form태그에서 delete랑 put을 마음대로 쓸 수 있게 해줌
app.set('view engine', 'ejs'); // EJS를 뷰 엔진으로 사용
app.use(express.json())
app.use(express.urlencoded({extended:true})) // req.body 쓰려면 이게 필요함


// EJS 템플릿이 있는 디렉토리 지정
app.set('views', path.join(__dirname, 'views'));

// MongoDB 클라이언트 생성
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// MongoDB 서버 연결 상태 확인 코드
async function run() {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
  }
}
run().catch(console.dir);

// DB 데이터 조회 및 렌더링
app.get('/home', async (req, res) => {
  try {
    // busapp 데이터베이스에 접속
    const db = client.db('busapp');
    // bus 컬렉션에 접속
    const collection = db.collection('bus');
    // bus 컬렉션에서 데이터 조회
    const data = await collection.find({}).sort({ _id: -1 }).limit(1).toArray();
    // 조회한 데이터를 index.ejs에 전달하여 렌더링함
    res.render('index3', { data });
    // console에 데이터를 띄우기
    console.log('Data from "bus" collection:', data);
  } catch (error) {
    console.error('Error retrieving data:', error);
    res.status(500).send('Internal Server Error');
  }
});

// 데이터를 주기적으로 업데이트하는 함수 생성
async function updateDataPeriodically() {
  try {
    // 데이터베이스에서 최신 데이터를 가져옴
    const db = client.db('busapp');
    const collection = db.collection('bus');
    const data = await collection.find({}).sort({ _id: -1 }).limit(1).toArray();

    // 데이터를 5초마다 업데이트하도록 설정
    setTimeout(updateDataPeriodically, 1000);
  } catch (error) {
    console.error('Error updating data periodically:', error);
  }
}
 

// 엔드포인트를 만들어 최신 데이터를 조회하고 json 형식으로 응답
app.get('/api/getLatestData', async (req, res) => {
  try {
    // 이미 생성된 MongoDB 클라이언트를 사용
    const db = client.db('busapp');
    const collection = db.collection('bus');
    const data = await collection.find({}).sort({ _id: -1 }).limit(1).toArray();

    // 최신 데이터를 JSON 형식으로 응답
    res.json({ lat: data[0].lat, lon: data[0].lon });
  } catch (error) {
    console.error('Error retrieving latest data:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


// 로그인 -------------------------------------------------------------------
// 로그인 
// 로그인 
// 로그인 
// 로그인 
// 로그인



// 제출한 아이디, 비밀번호가 DB와 일치하는지 검증
passport.use(new LocalStrategy(async (입력한아이디, 입력한비번, cb) => {
  const db = client.db('busapp');
  let user = await db.collection('user').findOne({ username: 입력한아이디 });
  if (!user) {
    return cb(null, false, { message: '아이디가 존재하지 않습니다.' });
  }
  if (await bcrypt.compare(입력한비번, user.password)) {
    return cb(null, user);
  } else {
    console.log()
    return cb(null, false, { message: '비밀번호가 일치하지 않습니다.' });
  }
}));



passport.serializeUser((user, done) => {
  console.log("serializeUser - User:", user);
  if (user && user._id) {
    done(null, user._id.toString());
  } else {
    done(new Error("User _id is undefined"));
  }
});



// 특정API에서만 사용 가능하게 수정하기
// 요청 너무 많으면 REDIS도 생각해보기
passport.deserializeUser(async (id, done) => {
  try {
    const db = client.db('busapp');
    let user = await db.collection('user').findOne({ _id: new ObjectId(id) });

    if (user) {
      // 관리자 여부를 확인하고 설정
      user.isAdmin = (user.username === ADMIN_USERNAME);

      done(null, user);
    } else {
      done(null, false); // 사용자가 없는 경우
    }
  } catch (error) {
    done(error); // 오류 처리
  }
});




app.get('/',(req,res) => {
  console.log(req.user)
  res.render('login.ejs');
});

function checkLogin(req,res,next){
  if (!req.user){
    res.redirect('/');
    return;
  }
  next()
}



// passport.authenticate('local', 콜백함수)(요청, 응답, next) 
// 위의 코드 작성시 검증 코드가 실행됨
// 검증 성공이나 실패시 뭔가 실행하고 싶다면 콜백함수 안에 작성

// 콜백함수의 첫째 파라미터 = 에러시 무언가 들어옴
// 둘째 파라미터 = 아이디/ 비번 검증 완료된 유저 정보가 들어옴
// 셋째 파라미터 = 아이디/ 비밀번호 검증 실패시 에러메시지가 들어옴
app.post('/login', async function(req, res, next) {
  const { username, password } = req.body;

  // 관리자 자격 증명 확인
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    try {
      // 데이터베이스에서 관리자 정보 조회
      const db = client.db('busapp');
      let adminUser = await db.collection('user').findOne({ username: ADMIN_USERNAME });
      
      if (adminUser) {
        // 관리자 로그인 처리
        req.login(adminUser, function(loginError) {
          if (loginError) {
            console.error("Login error:", loginError);
            return next(loginError);
          }
          console.log("Admin successfully logged in");
          res.redirect('/administration');
        });
      } else {
        // 관리자 정보가 없는 경우
        res.status(401).send("Invalid credentials.");
      }
    } catch (error) {
      // 데이터베이스 조회 오류 처리
      console.error("Database error:", error);
      res.status(500).send("Internal server error.");
    }
  } else {
    // Passport의 로컬 전략을 사용하여 일반 사용자 인증
  passport.authenticate('local', (error, user, info) => {
    if (error) {
      console.log("An error occurred during authentication:", error);
      return next(error);
    }
    if (!user) {
      console.log("Authentication failed:", info.message);
      return res.status(401).json(info.message);
    }

    // 일반 사용자로 로그인한 경우 isAdmin을 false로 설정
    user.isAdmin = false;

    req.login(user, (loginError) => {
      if (loginError) {
        console.log("Error during login session:", loginError);
        return next(loginError);
      }

      // 로그인한 사용자가 관리자인 경우 isAdmin을 true로 설정
      if (user.username === ADMIN_USERNAME) {
        user.isAdmin = true;
        
      }

      console.log("User successfully logged in:", user);
      res.redirect('/home');
    });
  })(req, res, next);

  }
});


// 관리자 여부 확인 미들웨어
function isAdmin(req, res, next) {
  console.log("Checking admin access:", req.user);
  if (req.user && req.user.isAdmin) {
    next(); // 관리자인 경우
  } else {
    res.status(403).send("관리자만 접근할 수 있습니다."); // 관리자가 아닌 경우 접근 거부
  }
}



// 관리자 페이지
app.get('/administration', isAdmin, (req, res) => {
  res.render('administration.ejs');
});

// 회원가입
// 회원가입
// 회원가입

app.get('/register',(req,res)=> {
  res.render('register.ejs')
})

app.post('/register', async (req,res) => {

  let 해시 = await bcrypt.hash(req.body.password, 10)
  console.log(해시)
  const db = client.db('busapp');
  await db.collection('user').insertOne({
    username : req.body.username,
    password : 해시,
    name : req.body.name,
    studentId : req.body.studentId,
    email : req.body.email
  })
  res.redirect('/')
})




// 버스 시간표 페이지
app.get('/timetable',(req,res) => {
  res.render('timetable.ejs');
});

app.use(checkLogin) 


// 마이페이지
app.get('/Mypage', async (req, res) => {
  const qrText = req.user.studentId; 
  const database = client.db('busapp');
  const collection = database.collection('BusSeat');
  const busData = await collection.find({ name: qrText } ).sort({ createdAt: -1 }).limit(1).toArray();
  const bus = busData[0];
  console.log(bus)
  QRCode.toDataURL(qrText, function (err, url) {
    if (err) {
      console.error(err);
      res.send("QR 코드 생성 중 오류 발생");
    } else {
      res.render('MyQRcode.ejs', { qrCode: url , user: req.user, bus: bus || {}});
    }
  });
});


// 커뮤니티
// 커뮤니티
// 커뮤니티

app.get('/community', async (req, res) => {
  const db = client.db('busapp');
  

  let result = await db.collection('post')
    .find({ _id: { $lt: new ObjectId( req.query.lastId) } })
    .sort({ createdAt: -1 , _id: -1}) // 최신 글부터 정렬
    .limit(5)
    .toArray();

  res.render('community.ejs', { 글목록: result });
});



// 누리광장 글 작성하기
app.get('/community/Write',(req,res) => {
  res.render('communityWrite.ejs')
})

app.post('/community/add', async (req, res) => {
  const db = client.db('busapp');
  console.log(req.body);
  try {
    if (req.body.title == '') {
      res.send('제목을 입력해주세요');
    } else {
      await db.collection('post').insertOne({
        title: req.body.title,
        content: req.body.content, // 데이터는 object형식으로 넣어야 함
        user : req.user._id,
        name : req.user.name
      });
      res.redirect('/community'); 
    }
  } catch (e) {
    console.error(e);
    res.status(500).send('서버 오류 발생');
  }
});

// 게시글 상세페이지
app.get('/community/detail/:id', async (req,res)=>{
  try{
    const db = client.db('busapp');
    let result = await db.collection('post').findOne({ _id : new ObjectId(req.params.id)})
    res.render('communityDetail.ejs', {result : result}) // result 변수를 result로 보내기
  }catch(e){
    console.log(e)
    res.status(404).send('잘못된 URL을 입력했습니다.')
  }
})

// 게시글 수정페이지
app.get('/community/edit/:id', async(req,res) => {
  const db = client.db('busapp');
  let result = await db.collection('post').findOne({_id: new ObjectId(req.params.id)})
  res.render('communityEdit.ejs', {result : result})
})

app.put('/community/edit', async(req,res) => {
  const db = client.db('busapp');
  await db.collection('post').updateOne({_id: new ObjectId(req.body.id)}, //수정할 문서 정보
  {$set : { title : req.body.title, content : req.body.content}})
  res.redirect('/community')
})

// 게시글 삭제 페이지
app.delete('/delete', async(req,res)=>{
  console.log(req.query)
  const db = client.db('busapp');
  await db.collection('post').deleteOne({_id : new ObjectId(req.query.docid),
  user : new ObjectId(req.user._id)
  })
  res.send('삭제 완료')
})


// 버스 예약 시스템 ---------------------------------------------------------
// 버스 예약 시스템
// 버스 예약 시스템
// 버스 예약 시스템
// 버스 예약 시스템
// 버스 예약 시스템


// 정류장 순서 매핑
const stationOrder = {
  "설립기념탑" : 1,
  "미대" : 2,
  "도서관" : 3,
  "IT융합대학" : 4,
  "본관 남쪽" : 5,
  "복관 북쪽" : 6,
  "학생회관" : 7
}

// 좌석 예약 페이지 접속시 ejs파일 렌더링
app.get('/seatRes',(req,res) => {
  const db = client.db('busapp');
  res.render('seatReservation.ejs',{user : req.user});
});



// 좌석 예약 추가 로직
async function addReservation(seatNumber, name, selectedTime, boardingStation, arrivalStation) {
 try {
    
    const database = client.db('busapp');
    const collection = database.collection('BusSeat');

    const currentDateTime = new Date();
    console.log('Attempting to insert reservation:', { seatNumber, name, selectedTime,boardingStation, arrivalStation,currentDateTime });
    const result = await collection.insertOne({ seatNumber, name, selectedTime , boardingStation, arrivalStation,currentDateTime});
    console.log('Insert operation result:', JSON.stringify(result, null, 2));

   
    const isInsertSuccessful = result.acknowledged && result.insertedId;
    console.log(`Reservation insert successful: ${isInsertSuccessful}`);

    return isInsertSuccessful;
  } catch (error) {
    console.error(`addReservation error: ${error}`);
    return false;
  }
}

app.get('/api/getReservedSeats', async (req, res) => {
  try {
    const { selectedTime } = req.query;
    const database = client.db('busapp');
    const collection = database.collection('BusSeat');
    const reservedSeats = await collection.find({ selectedTime }).toArray();
    res.status(200).json(reservedSeats);
  } catch (error) {
    res.status(500).send(`Server error: ${error.message}`);
  }
});


// 좌석 예약 API 엔드포인트
app.post('/api/reserveSeat', async (req, res) => {
  try {
    const { seatNumber, name, selectedTime, boardingStation, arrivalStation,reservationData } = req.body;
    // 정류장 순서 확인
    if (stationOrder[boardingStation] >= stationOrder[arrivalStation]) {
      return res.status(400).send("Invalid reservation: Arrival station must be after the boarding station.");
    }
    // 같은 시간대에 같은 좌석 번호에 대한 예약 확인
    const database = client.db('busapp');
    const collection = database.collection('BusSeat');
    const existingReservation = await collection.find({
      seatNumber,
      selectedTime,
      
    }).toArray();

    // existingReservation 객체를 콘솔에 출력
    console.log('Existing Reservation:', existingReservation);
    if (existingReservation && existingReservation.length > 0) {
      for (const reservation of existingReservation) {
        // 이미 예약된 각 하차 정류장과 새 예약의 출발 정류장을 비교
        if (stationOrder[boardingStation] <= stationOrder[reservation.arrivalStation]) {
          return res.status(400).send("Reservation not allowed: Overlapping with existing reservation.");
        }
      }
    }

    const isInsertSuccessful = await addReservation(seatNumber, name, selectedTime, boardingStation, arrivalStation);

    if (isInsertSuccessful) {
      res.status(201).send("Reservation successful");
    } else {
      res.status(500).send("Error creating reservation");
    }
  } catch (error) {
    // 오류 처리
    res.status(500).send(`Server error: ${error.message}`);
  }
});

// 관리자페이지 -----------------------------------------------------------
// 관리자페이지
// 관리자페이지
// 관리자페이지
// 관리자페이지
// 관리자페이지

// 일별 보고서
app.get('/administration/dailyReport',isAdmin, async(req,res)=> {
  const db = client.db('busapp');
  

  let result = await db.collection('BusSeat')
    .find({ _id: { $lt: new ObjectId( req.query.lastId) } })
    .sort({ createdAt: -1 , _id: -1}) 
    .toArray();
  res.render('adminDailyReport.ejs',{ reservation : result})
})

// 데이터 분석 결과를 보고서 형식으로 볼 수 있는 섹션을 포함합니다.
// 시간대별, 정류장별, 좌석별 예약 현황을 보여주는 그래프 포함.

// ------------------------------------------------------------------

// 데이터 분석
app.get('/administration/dataAnalysis', isAdmin, async (req,res)=> {
  const db = client.db('busapp');
  

  let result = await db.collection('BusSeat')
    .find({ _id: { $lt: new ObjectId( req.query.lastId) } })
    .sort({ createdAt: -1 , _id: -1}) 
    .toArray();
  res.render('adminAnalysis.ejs', { reservation : result})
})

// 시간대별 예약 현황: 하루 중 어느 시간대에 가장 많은 예약이 이루어지는지를 보여주는 막대 그래프.
// 정류장별 이용 현황: 각 정류장에서 탑승하는 승객 수를 보여주는 막대 그래프.
// 좌석별 인기도: 각 좌석이 얼마나 자주 예약되는지를 보여주는 히트맵.

// ------------------------------------------------------------------
// 사용자 관리
app.get('/administration/userManagement', isAdmin, async(req,res)=> {
  const db = client.db('busapp');
  let result = await db.collection('user')
    .find({ _id: { $lt: new ObjectId( req.query.lastId) } })
    .sort({ createdAt: -1 , _id: -1}) // 최신 글부터 정렬
    .toArray();
  res.render('adminUserManage.ejs',{users: result})
})

// 계정 삭제 
app.delete('/userManagement/delete',isAdmin,  async(req,res)=>{
  const db = client.db('busapp');
  await db.collection('user').deleteOne({_id : new ObjectId(req.query.docid)})
  res.send('삭제 완료')
})

// 사용자 계정 관리 기능을 포함합니다.
// 신규 계정 생성, 기존 계정 수정 및 삭제 등의 기능을 제공합니다.


// ------------------------------------------------------------------

// 예약 관리
// 예약 데이터를 조회, 삭제할 수 있음

app.get('/administration/reservationManagement', isAdmin, async (req, res) => {
  const db = client.db('busapp');
  let result = await db.collection('BusSeat')
    .find({ _id: { $lt: new ObjectId( req.query.lastId) } })
    .sort({ createdAt: -1 , _id: -1})
    .limit(10)
    .toArray();
  res.render('adminReservationManagement.ejs', { reservationInfo: result });
});



// 예약 삭제 
app.delete('/administration/delete', async(req,res)=>{
  const db = client.db('busapp');
  await db.collection('BusSeat').deleteOne({_id : new ObjectId(req.query.docid)})
  res.send('삭제 완료')
})



// ------------------------------------------------------------------
// 서버 시작
app.listen(process.env.PORT, () => {
  console.log('Server started on port');
  // 주기적으로 데이터를 업데이트하는 함수 호출
  updateDataPeriodically();
});