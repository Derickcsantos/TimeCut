require('dotenv').config();
const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const { create } = require('@wppconnect-team/wppconnect');
const cookieParser = require('cookie-parser');
const ExcelJS = require('exceljs');
const multer = require('multer');
const fs = require('fs');
const mongoose = require('mongoose');

let whatsappClient = null;
const SESSION_DIR = path.join(__dirname, 'tokens');
const SESSION_FILE = path.join(SESSION_DIR, 'salon-bot.json');

const app = express();
const port = process.env.PORT || 3000;

// Configuração do Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);
app.use(cookieParser());

// Criar diretório se não existir
if (!fs.existsSync(SESSION_DIR)) {
  fs.mkdirSync(SESSION_DIR, { recursive: true });
}

const corsOptions = {
  origin: '*',              // Permite qualquer origem
  methods: ['GET', 'POST', 'PUT', 'DELETE'],  // Permite os métodos HTTP que você precisa
  allowedHeaders: ['Content-Type'], // Permite esses cabeçalhos específicos
  credentials: true,        // Permite cookies (importante se for necessário)
};

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB conectado com sucesso'))
.catch(err => console.error('Erro ao conectar ao MongoDB:', err));

// Modelo para galeria
const galeriaSchema = new mongoose.Schema({
  titulo: { type: String, required: true },
  imagem: { type: String, required: true }, // Caminho da imagem no servidor
  criadoEm: { type: Date, default: Date.now }
});

const Galeria = mongoose.model('Galeria', galeriaSchema);
// Configuração do Multer para upload de imagens

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, 'public/uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Apenas imagens são permitidas!'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

// Middlewares
app.use(cors(corsOptions));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));


const checkAuth = (req, res, next) => {
  const userData = req.cookies.userData;  // Obtendo os dados do usuário do cookie

  if (!userData) {
    return res.status(403).send('Acesso negado');  // Caso não tenha cookie
  }

  const parsedUser = JSON.parse(userData);

  // Verificando se o tipo do usuário é 'admin'
  if (parsedUser.tipo === 'admin') {
    next();  // Usuário autorizado, segue para a rota do admin
  } else {
    return res.status(403).send('Acesso negado');
  }
};

// Rotas para servir os arquivos HTML
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/home', (req, res) => res.sendFile(path.join(__dirname, 'public', 'home.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/galeria', (req, res) => res.sendFile(path.join(__dirname, 'public', 'galeria.html')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
// app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/admin', checkAuth, async (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Rota para a página inicial logada
app.get('/logado', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'logado.html'), {
    headers: {
      'Content-Type': 'text/html',
      'Cache-Control': 'no-cache'
    }
  });
});

// Rota para a página de agendamentos
app.get('/logado/agendamentos', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'logado.html'), {
    headers: {
      'Content-Type': 'text/html',
      'Cache-Control': 'no-cache'
    }
  });
});


const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Rota para enviar email de contato
app.post('/api/contact', async (req, res) => {
    const { name, email, phone, message } = req.body;

    // Validação básica
    if (!name || !email || !message) {
        return res.status(400).json({ error: 'Nome, email e mensagem são obrigatórios' });
    }

    // Configuração do transporter (substitua com suas credenciais SMTP)
    const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false, // true para 465, false para outras portas
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    // Configuração do email
    const mailOptions = {
        from: `"Formulário de Contato" <${email}>`,
        to: 'salaopaulatrancas@gmail.com',
        subject: `Nova mensagem de ${name} - Site Paula Tranças`,
        text: `
            Nome: ${name}
            Email: ${email}
            Telefone: ${phone || 'Não informado'}
            
            Mensagem:
            ${message}
        `,
        html: `
            <h2>Nova mensagem do site Paula Tranças</h2>
            <p><strong>Nome:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Telefone:</strong> ${phone || 'Não informado'}</p>
            <p><strong>Mensagem:</strong></p>
            <p>${message.replace(/\n/g, '<br>')}</p>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        res.status(200).json({ message: 'Mensagem enviada com sucesso!' });
    } catch (error) {
        console.error('Erro ao enviar email:', error);
        res.status(500).json({ error: 'Ocorreu um erro ao enviar a mensagem. Por favor, tente novamente mais tarde.' });
    }
});

// Função para gerar senha
function gerarSenha() {
  const letras = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numeros = '0123456789';

  let senha = '';
  for (let i = 0; i < 4; i++) {
    senha += letras.charAt(Math.floor(Math.random() * letras.length));
  }
  for (let i = 0; i < 3; i++) {
    senha += numeros.charAt(Math.floor(Math.random() * numeros.length));
  }

  return senha;
}

// Busca usuário por email
async function findUserByEmail(email) {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, username')
    .eq('email', email)
    .single();

  if (error) {
    console.error('Erro ao buscar usuário por email:', error);
    return null;
  }

  return data;
}

// Atualiza a senha do usuário
async function updateUserPassword(userId, newPassword) {
  const { error } = await supabase
    .from('users')
    .update({ password_plaintext: newPassword })
    .eq('id', userId);

  if (error) {
    throw error;
  }
}


// Rota para recuperação de senha
app.post('/api/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    // Aqui você deve verificar se o email existe no seu banco de dados
    // Esta é uma implementação simulada - substitua pela sua lógica real
    const user = await findUserByEmail(email); // Você precisa implementar esta função
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'Email não encontrado' });
    }

    // Gera nova senha
    const newPassword = gerarSenha();
    
    // Atualiza a senha no banco de dados (implemente esta função)
    await updateUserPassword(user.id, newPassword);
    
    // Envia email com a nova senha
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Recuperação de Senha - Salão de Beleza',
      html: `
        <h2>Recuperação de Senha</h2>
        <p>Você solicitou uma nova senha para acessar o sistema do Salão de Beleza.</p>
        <p>Sua nova senha é: <strong>${newPassword}</strong></p>
        <p>Recomendamos que você altere esta senha após o login.</p>
        <p>Caso não tenha solicitado esta alteração, por favor ignore este email.</p>
      `
    };

    await transporter.sendMail(mailOptions);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Erro na recuperação de senha:', error);
    res.status(500).json({ success: false, error: 'Erro ao processar solicitação' });
  }
});

app.post('/api/send-confirmation-email', async (req, res) => {
  try {
    const { email, subject, body } = req.body;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: subject,
      html: body
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: 'E-mail enviado com sucesso' });
  } catch (error) {
    console.error('Erro ao enviar e-mail:', error);
    res.status(500).json({ error: 'Erro ao enviar e-mail' });
  }
});

// Rota para enviar mensagem via WhatsApp
app.post('/api/send-whatsapp-confirmation', async (req, res) => {
  try {
    const { clientPhone, appointmentDetails } = req.body;

    if (!whatsappClient) {
      return res.status(500).json({ 
        success: false, 
        error: "WhatsApp não conectado. Por favor, reinicie o servidor." 
      });
    }

    // Validação dos dados
    if (!clientPhone || !appointmentDetails) {
      return res.status(400).json({
        success: false,
        error: "Dados incompletos"
      });
    }

    const formattedPhone = `55${clientPhone.replace(/\D/g, '')}@c.us`;
    const message = `📅 *Confirmação de Agendamento* \n\n` +
      `✅ *Serviço:* ${appointmentDetails.service}\n` +
      `👩🏾‍💼 *Profissional:* ${appointmentDetails.professional}\n` +
      `📆 *Data:* ${appointmentDetails.date}\n` +
      `⏰ *Horário:* ${appointmentDetails.time}\n\n` +
      `_Agradecemos sua preferência!_`;

    // Envia a mensagem
    await whatsappClient.sendText(formattedPhone, message);
    
    res.json({ success: true });

  } catch (error) {
    console.error("Erro ao enviar WhatsApp:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message || "Falha no envio" 
    });
  }
});

// Health Check
app.get('/health', (req, res) => {
  res.status(whatsappClient ? 200 : 503).json({
    status: whatsappClient ? 'healthy' : 'unavailable',
    timestamp: new Date()
  });
});
async function startWhatsappBot() {
  try {
    const sessionExists = fs.existsSync(SESSION_FILE);
    
    const client = await create({
      session: 'salon-bot',
      puppeteerOptions: {
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
        headless: "new",
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--single-process',
          '--no-zygote'
        ],
        ignoreDefaultArgs: ['--disable-extensions']
      },
      catchQR: (base64Qr) => {
        if (!sessionExists) {
          console.log('=== SCANEAE ESTE QR CODE UMA VEZ ===');
          console.log('Base64 QR:', base64Qr);
        }
      },
      statusFind: (status) => {
        console.log('Status:', status);
        if (status === 'authenticated') {
          console.log('✅ Login realizado!');
        }
      }
    });

    client.on('authenticated', (session) => {
      fs.writeFileSync(SESSION_FILE, JSON.stringify(session));
    });

    client.onMessage(async (message) => {
      if (message.body === '!ping') {
        await client.sendText(message.from, '🏓 Pong!');
      }
    });

    console.log('🤖 Bot iniciado com sucesso');

  } catch (error) {
    console.error('Erro crítico no bot:', error);
    // Não encerre o processo, permita reinicialização
    setTimeout(startWhatsappBot, 30000); // Tenta reiniciar em 30 segundos
  }
}

// Rota para obter todos os usuários
app.get('/api/users', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Rota para obter um usuário específico
app.get('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Usuário não encontrado' });
    
    res.json(data);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Rota para criar um novo usuário
app.post('/api/users', async (req, res) => {
  const { username, email, password_plaintext, tipo = 'comum' } = req.body;

  try {
    // Verifica se já existe usuário com mesmo username ou email
    const { data: existingUsers, error: userError } = await supabase
      .from('users')
      .select('id')
      .or(`username.eq.${username},email.eq.${email}`);

    if (userError) throw userError;

    if (existingUsers && existingUsers.length > 0) {
      return res.status(400).json({
        error: 'Usuário ou email já cadastrado'
      });
    }

    // Insere novo usuário
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert([{
        username,
        email,
        password_plaintext,
        tipo,
        created_at: new Date().toISOString()
      }])
      .select('*')
      .single();

    if (insertError) throw insertError;

    res.json(newUser);
  } catch (err) {
    console.error('Erro ao cadastrar usuário:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para atualizar um usuário
app.put('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, password_plaintext, tipo } = req.body;

    if (!username || !email) {
      return res.status(400).json({ error: 'Nome de usuário e e-mail são obrigatórios' });
    }

    const updateData = {
      username,
      email,
      updated_at: new Date().toISOString(),
      ...(tipo && { tipo }),
      ...(password_plaintext && { password_plaintext })
    };

    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Rota para excluir um usuário
app.delete('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Verifica se o usuário existe
    const { data: existingUser, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('id', id)
      .single();

    if (userError || !existingUser) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Exclui o usuário
    const { error: deleteError } = await supabase
      .from('users')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    res.json({ success: true });
  } catch (err) {
    console.error('Erro ao excluir usuário:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota de cadastro
app.post('/api/register', async (req, res) => {
  const { username, email, aniversario, password_plaintext } = req.body;

  try {
    // Verifica se já existe usuário com mesmo username ou email
    const { data: existingUsers, error: userError } = await supabase
      .from('users')
      .select('id')
      .or(`username.eq.${username},email.eq.${email}`);

    if (userError) {
      throw userError;
    }

    if (existingUsers && existingUsers.length > 0) {
      return res.status(400).json({
        error: 'Usuário ou email já cadastrado'
      });
    }

    // Insere novo usuário com tipo "comum"
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert([{
        username,
        email,
        aniversario,
        password_plaintext, // Em produção: criptografar
        tipo: 'comum',
        created_at: new Date().toISOString()
      }])
      .select('id, username, email, aniversario, created_at')
      .single();

    if (insertError) {
      throw insertError;
    }

    res.json({
      success: true,
      user: newUser
    });

  } catch (err) {
    console.error('Erro ao cadastrar usuário:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});


// ... (o restante do código permanece o mesmo)
// Rota de login simplificada (SEM HASH - APENAS PARA DESENVOLVIMENTO)
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, email, password_plaintext, tipo')
      .eq('username', username)
      .single();

    if (error || !user || user.password_plaintext !== password) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    // Se a autenticação for bem-sucedida, define o cookie com os dados do usuário
    const userData = {
      id: user.id,
      username: user.username,
      email: user.email,
      tipo: user.tipo
    };

    res.cookie('userData', JSON.stringify(userData), {
      httpOnly: true,   // Evita que o cookie seja acessado via JavaScript
      secure: false,    // Coloque true se estiver usando HTTPS em produção
      maxAge: 60 * 60 * 1000, // Expira após 1 hora
    });

    res.json({
      success: true,
      user: userData
    });

  } catch (err) {
    console.error('Erro ao fazer login:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});


app.post('/api/verifica-usuario', async (req, res) => {
  const { username } = req.body;

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .single();

    if (error || !user) {
      return res.json({ exists: false });
    }

    res.json({ exists: true });
  } catch (err) {
    console.error('Erro ao verificar usuário:', err);
    res.status(500).json({ exists: false });
  }
});


// API para o frontend (Agendamento)
app.get('/api/categories', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('id, name, imagem_category') // Adicionar imagem_category
      .order('name', { ascending: true });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/services/:categoryId', async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { data, error } = await supabase
      .from('services')
      .select('id, name, price, duration, imagem_service') // Adicionar imagem_service
      .eq('category_id', categoryId)
      .order('name', { ascending: true });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/employees/:serviceId', async (req, res) => {
  try {
    const { serviceId } = req.params;
    const { data, error } = await supabase
      .from('employee_services')
      .select('employees(*)')
      .eq('service_id', serviceId);

    if (error) throw error;
    const employees = data.map(item => item.employees);
    res.json(employees);
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


app.get('/api/available-times', async (req, res) => {
  try {
    const { employeeId, date, duration } = req.query;
    console.log('Parâmetros recebidos:', { employeeId, date, duration });
    
    const dateObj = new Date(date);
    const dayOfWeek = dateObj.getDay(); // 0-6 (Domingo-Sábado)
    console.log('Dia da semana calculado:', dayOfWeek)

    const { data: schedule, error: scheduleError } = await supabase
      .from('work_schedules')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('day_of_week', dayOfWeek)
      .single();

    if (scheduleError || !schedule || !schedule.is_available) {
      return res.json([]);
    }

    const { data: appointments, error: appointmentsError } = await supabase
      .from('appointments')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('appointment_date', date)
      .order('start_time', { ascending: true });

    if (appointmentsError) throw appointmentsError;

    const workStart = new Date(`${date}T${schedule.start_time}`);
    const workEnd = new Date(`${date}T${schedule.end_time}`);
    const interval = 15 * 60 * 1000;
    const durationMs = duration * 60 * 1000;
    
    let currentSlot = new Date(workStart);
    const availableSlots = [];

    while (currentSlot.getTime() + durationMs <= workEnd.getTime()) {
      const slotStart = new Date(currentSlot);
      const slotEnd = new Date(slotStart.getTime() + durationMs);
      
      const isAvailable = !appointments.some(appointment => {
        const apptStart = new Date(`${date}T${appointment.start_time}`);
        const apptEnd = new Date(`${date}T${appointment.end_time}`);
        
        return (
          (slotStart >= apptStart && slotStart < apptEnd) ||
          (slotEnd > apptStart && slotEnd <= apptEnd) ||
          (slotStart <= apptStart && slotEnd >= apptEnd)
        );
      });
      
      if (isAvailable) {
        availableSlots.push({
          start: slotStart.toTimeString().substring(0, 5),
          end: slotEnd.toTimeString().substring(0, 5)
        });
      }
      
      currentSlot = new Date(currentSlot.getTime() + interval);
    }

    res.json(availableSlots);
  } catch (error) {
    console.error('Error fetching available times:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/appointments', async (req, res) => {
  try {
    const { client_name, client_email, client_phone, service_id, employee_id, date, start_time, end_time , final_price , coupon_code , original_price } = req.body;
    
    const { data, error } = await supabase
      .from('appointments')
      .insert([{
        client_name,
        client_email,
        client_phone,
        service_id,
        employee_id,
        appointment_date: date,
        start_time,
        end_time,
        final_price,
        coupon_code,
        original_price, 
        status: 'confirmed'
      }])
      .select();

    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (error) {
    console.error('Error creating appointment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Rota para obter agendamentos por email (área do cliente)
app.get('/api/logado/appointments', async (req, res) => {
  try {
    const { email } = req.query;
    
    // Busca os agendamentos do cliente
    const { data, error } = await supabase
      .from('appointments')
      .select(`
        id,
        client_name,
        client_email,
        client_phone,
        appointment_date,
        start_time,
        end_time,
        status,
        created_at,
        services(name, price),
        employees(name)
      `)
      .eq('client_email', email)
      .order('appointment_date', { ascending: true })
      .order('start_time', { ascending: true });

    if (error) throw error;

    // Formata os dados para resposta
    const formattedData = data.map(item => ({
      id: item.id,
      date: item.appointment_date,
      start_time: item.start_time,
      end_time: item.end_time,
      status: item.status,
      created_at: item.created_at,
      service_name: item.services?.name,
      service_price: item.services?.price,
      professional_name: item.employees?.name,
      client_name: item.client_name,
      client_email: item.client_email,
      client_phone: item.client_phone
    }));

    res.json(formattedData);
  } catch (error) {
    console.error('Error fetching client appointments:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Rotas para agendamentos (admin)
app.get('/api/admin/appointments', async (req, res) => {
  try {
    const { search, date, employee } = req.query;
    let query = supabase
      .from('appointments')
      .select(`
        *,
        services:service_id (name, price),
        employees:employee_id (name)
      `)
      .order('appointment_date', { ascending: true })
      .order('start_time', { ascending: true });

    if (search) {
      query = query.or(`client_name.ilike.%${search}%,client_email.ilike.%${search}%,client_phone.ilike.%${search}%`);
    }

    if (date) {
      // Converte DD-MM-YYYY para YYYY-MM-DD (formato do Supabase)
      const [day, month, year] = date.split('-');
      const dbDate = `${year}-${month}-${day}`;
      query = query.eq('appointment_date', dbDate);
    }

    if (employee) {
      // Filtrar usando a relação com employees
      query = query.ilike('employees.name', `%${employee}%`);
    }

    const { data, error } = await query;

    if (error) throw error;
    
    // Filtro adicional para funcionários (caso o filtro do Supabase não funcione)
    let filteredData = data;
    if (employee) {
      filteredData = data.filter(appt => 
        appt.employees?.name?.toLowerCase().includes(employee.toLowerCase())
      );
    }

    res.json(filteredData);
  } catch (error) {
    console.error('Error fetching appointments:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Rota para obter detalhes de um agendamento específico
app.get('/api/admin/appointments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('appointments')
      .select(`
        *,
        services(name, price),
        employees(name)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Agendamento não encontrado' });

    res.json({
      id: data.id,
      client_name: data.client_name,
      service: data.services?.name || 'N/A',
      professional: data.employees?.name || 'N/A',
      date: data.appointment_date, // Formato YYYY-MM-DD
      start_time: data.start_time, // Formato HH:MM:SS
      end_time: data.end_time,     // Formato HH:MM:SS
      status: data.status,
      price: data.services?.price || 0
    });
  } catch (error) {
    console.error('Error fetching appointment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Rota para marcar agendamento como concluído
app.put('/api/admin/appointments/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('appointments')
      .update({ 
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', id)
      .select();

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Agendamento não encontrado' });
    }

    res.json(data[0]);
  } catch (error) {
    console.error('Error in API:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

app.put('/api/admin/appointments/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('appointments')
      .update({ status: 'canceled' })
      .eq('id', id)
      .select();

    if (error) throw error;
    res.json(data[0]);
  } catch (error) {
    console.error('Error canceling appointment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// Rotas para categorias
app.get('/api/admin/categories', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/admin/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Categoria não encontrada' });
    
    res.json(data);
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Atualize a rota POST de categorias
app.post('/api/admin/categories', upload.single('image'), async (req, res) => {
  try {
    const { name } = req.body;
    const imagePath = req.file ? `/uploads/${req.file.filename}` : null;

    const { data, error } = await supabase
      .from('categories')
      .insert([{ 
        name, 
        imagem_category: imagePath 
      }])
      .select();

    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (error) {
    console.error('Error creating category:', error);
    // Remove o arquivo se houve erro
    if (req.file) fs.unlinkSync(path.join(__dirname, 'public', req.file.path));
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});


// Atualize a rota PUT de categorias
app.put('/api/admin/categories/:id', upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    let imagePath = null;

    // Se enviou nova imagem
    if (req.file) {
      imagePath = `/uploads/${req.file.filename}`;
      
      // Busca a categoria antiga para remover a imagem anterior
      const { data: oldCategory } = await supabase
        .from('categories')
        .select('imagem_category')
        .eq('id', id)
        .single();

      if (oldCategory?.imagem_category) {
        const oldImagePath = path.join(__dirname, 'public', oldCategory.imagem_category);
        if (fs.existsSync(oldImagePath)) fs.unlinkSync(oldImagePath);
      }
    }

    const { data, error } = await supabase
      .from('categories')
      .update({ 
        name,
        ...(imagePath && { imagem_category: imagePath })
      })
      .eq('id', id)
      .select();

    if (error) throw error;
    res.json(data[0]);
  } catch (error) {
    console.error('Error updating category:', error);
    if (req.file) fs.unlinkSync(path.join(__dirname, 'public', req.file.path));
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

app.delete('/api/admin/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/services', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Rotas para serviços
app.get('/api/admin/services', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('services')
      .select('*, categories(name)')
      .order('name', { ascending: true });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Atualize as rotas de serviços similarmente
app.post('/api/admin/services', upload.single('image'), async (req, res) => {
  try {
    const { category_id, name, description, duration, price } = req.body;
    const imagePath = req.file ? `/uploads/${req.file.filename}` : null;

    const { data, error } = await supabase
      .from('services')
      .insert([{ 
        category_id, 
        name, 
        description, 
        duration, 
        price,
        imagem_service: imagePath
      }])
      .select();

    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (error) {
    console.error('Error creating service:', error);
    if (req.file) fs.unlinkSync(path.join(__dirname, 'public', req.file.path));
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

app.get('/api/admin/services/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('services')
      .select('*, categories(name)')
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Serviço não encontrado' });
    
    res.json(data);
  } catch (error) {
    console.error('Error fetching service:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/admin/services/:id', upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const { category_id, name, description, duration, price } = req.body;
    let imagePath = null;

    if (req.file) {
      imagePath = `/uploads/${req.file.filename}`;
      
      const { data: oldService } = await supabase
        .from('services')
        .select('imagem_service')
        .eq('id', id)
        .single();

      if (oldService?.imagem_service) {
        const oldImagePath = path.join(__dirname, 'public', oldService.imagem_service);
        if (fs.existsSync(oldImagePath)) fs.unlinkSync(oldImagePath);
      }
    }

    const { data, error } = await supabase
      .from('services')
      .update({ 
        category_id,
        name,
        description,
        duration,
        price,
        ...(imagePath && { imagem_service: imagePath })
      })
      .eq('id', id)
      .select();

    if (error) throw error;
    res.json(data[0]);
  } catch (error) {
    console.error('Error updating service:', error);
    if (req.file) fs.unlinkSync(path.join(__dirname, 'public', req.file.path));
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

app.delete('/api/admin/services/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase
      .from('services')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting service:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/admin/employees', async (req, res) => {
  try {
    // Buscar funcionários
    const { data: employees, error: employeesError } = await supabase
      .from('employees')
      .select('*')
      .order('created_at', { ascending: false });

    if (employeesError) throw employeesError;

    // Buscar serviços e horários para cada funcionário
    const employeesWithDetails = await Promise.all(
      employees.map(async employee => {
        // Buscar serviços
        const { data: services, error: servicesError } = await supabase
          .from('employee_services')
          .select('services(name)')
          .eq('employee_id', employee.id);

        if (servicesError) throw servicesError;

        // Buscar horários
        const { data: schedules, error: schedulesError } = await supabase
          .from('work_schedules')
          .select('*')
          .eq('employee_id', employee.id);

        if (schedulesError) throw schedulesError;

        return { 
          ...employee, 
          services: services?.map(item => item.services) || [],
          work_schedules: schedules || [] 
        };
      })
    );

    res.json(employeesWithDetails);
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

app.get('/api/admin/employees/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error fetching employee:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/admin/employees', async (req, res) => {
  try {
    const { name, email, phone, comissao , is_active } = req.body;
    const { data, error } = await supabase
      .from('employees')
      .insert([{ 
        name, 
        email, 
        phone,
        comissao, 
        is_active: is_active !== false 
      }])
      .select();

    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (error) {
    console.error('Error creating employee:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/admin/employees/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, comissao , is_active } = req.body;
    const { data, error } = await supabase
      .from('employees')
      .update({ 
        name, 
        email, 
        phone, 
        comissao,
        is_active 
      })
      .eq('id', id)
      .select();

    if (error) throw error;
    res.json(data[0]);
  } catch (error) {
    console.error('Error updating employee:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/admin/employees/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Primeiro deletar os horários associados
    const { error: scheduleError } = await supabase
      .from('work_schedules')
      .delete()
      .eq('employee_id', id);

    if (scheduleError) throw scheduleError;

    // Depois deletar o funcionário
    const { error: employeeError } = await supabase
      .from('employees')
      .delete()
      .eq('id', id);

    if (employeeError) throw employeeError;

    res.status(204).end();
  } catch (error) {
    console.error('Error deleting employee:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Rota para obter serviços de um funcionário
app.get('/api/employee-services/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { data, error } = await supabase
      .from('employee_services')
      .select('service_id')
      .eq('employee_id', employeeId);

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error fetching employee services:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Rota para atualizar serviços de um funcionário
app.put('/api/employee-services/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;
    const services = req.body;

    // Primeiro deletar todos os serviços atuais
    const { error: deleteError } = await supabase
      .from('employee_services')
      .delete()
      .eq('employee_id', employeeId);

    if (deleteError) throw deleteError;

    // Depois inserir os novos serviços (se houver)
    if (services.length > 0) {
      const { error: insertError } = await supabase
        .from('employee_services')
        .insert(services);

      if (insertError) throw insertError;
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating employee services:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ROTAS DE HORÁRIOS
app.get("/schedules", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("work_schedules")
      .select("*, employees(name, email)");

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error fetching schedules:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Rota para criar/atualizar horários
app.post("/schedules", async (req, res) => {
  try {
    const { employee_id, day_of_week, start_time, end_time, is_available = true } = req.body;

    // Validações
    if (!employee_id || day_of_week === undefined || !start_time || !end_time) {
      return res.status(400).json({ 
        error: 'Dados incompletos',
        details: 'employee_id, day_of_week (número), start_time e end_time são obrigatórios'
      });
    }

    // Converter dia da semana para número se for string
    const dayNumber = convertDayToNumber(day_of_week);
    if (dayNumber === null) {
      return res.status(400).json({ 
        error: 'Dia da semana inválido',
        details: 'Use número (0-6) ou nome do dia (ex: "Segunda-feira")'
      });
    }

    // Formatando os horários para HH:MM:SS
    const formattedStart = formatTimeToHHMMSS(start_time);
    const formattedEnd = formatTimeToHHMMSS(end_time);

    // Inserção no banco
    const { data, error } = await supabase
      .from("work_schedules")
      .insert([{ 
        employee_id, 
        day_of_week: dayNumber, 
        start_time: formattedStart, 
        end_time: formattedEnd, 
        is_available 
      }])
      .select();

    if (error) throw error;
    res.status(201).json(data[0]);

  } catch (error) {
    console.error('Erro no servidor:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// Funções auxiliares
function convertDayToNumber(day) {
  if (typeof day === 'number') {
    return (day >= 0 && day <= 6) ? day : null;
  }

  const daysMap = {
    'segunda': 0, 'segunda-feira': 0,
    'terça': 1, 'terça-feira': 1,
    'quarta': 2, 'quarta-feira': 2,
    'quinta': 3, 'quinta-feira': 3,
    'sexta': 4, 'sexta-feira': 4,
    'sábado': 5, 'sabado': 5,
    'domingo': 6
  };

  return daysMap[day.toLowerCase()] || null;
}

function formatTimeToHHMMSS(time) {
  if (!time) return '09:00:00'; // Valor padrão
  
  // Se já está no formato HH:MM:SS
  if (typeof time === 'string' && time.match(/^\d{2}:\d{2}:\d{2}$/)) {
    return time;
  }
  
  // Se está no formato HH:MM
  if (typeof time === 'string' && time.match(/^\d{2}:\d{2}$/)) {
    return `${time}:00`;
  }
  
  // Se é um número como 800 (8:00) ou 1700 (17:00)
  if (typeof time === 'number') {
    const timeStr = String(time).padStart(4, '0');
    return `${timeStr.substr(0, 2)}:${timeStr.substr(2, 2)}:00`;
  }
  
  return '09:00:00'; // Valor padrão se não reconhecer
}

// Função auxiliar de validação
function isValidTime(time) {
  return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
}

app.get("/schedules/:employee_id", async (req, res) => {
  try {
    const { employee_id } = req.params;
    const { data, error } = await supabase
      .from("work_schedules")
      .select("*")
      .eq("employee_id", employee_id);

    if (error) throw error;
    
    // Função para converter número para nome do dia
    const convertNumberToDayName = (dayNumber) => {
      const days = [
        'Segunda-feira', 
        'Terça-feira',
        'Quarta-feira',
        'Quinta-feira',
        'Sexta-feira',
        'Sábado',
        'Domingo'
      ];
      return days[dayNumber] || 'Dia inválido';
    };

    // Formatar os dados antes de retornar
    const formattedData = data.map(schedule => ({
      ...schedule,
      day: convertNumberToDayName(schedule.day_of_week), // Adiciona o nome do dia
      start_time: formatTimeFromDB(schedule.start_time),
      end_time: formatTimeFromDB(schedule.end_time)
    }));
    
    res.json(formattedData);
  } catch (error) {
    console.error('Error fetching employee schedules:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Função auxiliar para formatar o horário do banco de dados
function formatTimeFromDB(time) {
  if (!time) return null;
  
  // Se já estiver no formato HH:MM
  if (typeof time === 'string' && time.includes(':')) return time;
  
  // Se for um número (como 100000 para 10:00:00)
  if (typeof time === 'number') {
    const timeStr = String(time).padStart(6, '0');
    return `${timeStr.substr(0, 2)}:${timeStr.substr(2, 2)}`;
  }
  
  return time;
}

app.put('/schedules/:employee_id', async (req, res) => {
  try {
    const { employee_id } = req.params;
    const schedules = req.body;

    // Verificar se o funcionário existe
    const { data: employee, error: employeeError } = await supabase
      .from('employees')
      .select('id')
      .eq('id', employee_id)
      .single();

    if (employeeError || !employee) {
      throw new Error('Funcionário não encontrado');
    }

    // Deletar horários existentes
    const { error: deleteError } = await supabase
      .from('work_schedules')
      .delete()
      .eq('employee_id', employee_id);

    if (deleteError) throw deleteError;

    // Inserir novos horários (se houver)
    if (schedules.length > 0) {
      // Validar horários
      const validSchedules = schedules.map(schedule => {
        if (isNaN(schedule.day_of_week) || schedule.day_of_week < 0 || schedule.day_of_week > 6) {
          throw new Error('Dia da semana inválido');
        }

        return {
          employee_id,
          day_of_week: schedule.day_of_week,
          start_time: schedule.start_time,
          end_time: schedule.end_time
        };
      });

      const { error: insertError } = await supabase
        .from('work_schedules')
        .insert(validSchedules);

      if (insertError) throw insertError;
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating schedules:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message
    });
  }
});

app.delete("/schedules/employees/:employee_id", async (req, res) => {
  try {
    const { employee_id } = req.params;
    const { error } = await supabase
      .from("work_schedules")
      .delete()
      .eq("employee_id", employee_id);

    if (error) throw error;
    res.status(204).end();
  } catch (error) {
    console.error('Error deleting employee schedules:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete("/schedules/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase
      .from("work_schedules")
      .delete()
      .eq("id", id);

    if (error) throw error;
    res.status(204).end();
  } catch (error) {
    console.error('Error deleting schedule:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Rota para dados do dashboard
// Rota para dados do dashboard
app.get('/api/admin/dashboard', async (req, res) => {
  try {
    // 1. Contagem básica de funcionários, categorias, serviços e agendamentos
    const [
      { count: employeesCount },
      { count: categoriesCount },
      { count: servicesCount },
      { count: appointmentsCount }
    ] = await Promise.all([
      supabase.from('employees').select('*', { count: 'exact', head: true }),
      supabase.from('categories').select('*', { count: 'exact', head: true }),
      supabase.from('services').select('*', { count: 'exact', head: true }),
      supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('status', 'confirmed')
    ]);

    // 2. Dados detalhados para os gráficos
    const [
      { data: employeesData, error: employeesError },
      { data: usersData, error: usersError },
      { data: couponsData, error: couponsError },
      { data: appointmentsData, error: appointmentsError }
    ] = await Promise.all([
      supabase.from('employees').select('is_active'),
      supabase.from('users').select('tipo'),
      supabase.from('coupons').select('is_active'),
      supabase.from('appointments').select('appointment_date').eq('status', 'confirmed')
    ]);

    // Verificar erros nas consultas
    if (employeesError || usersError || couponsError || appointmentsError) {
      throw new Error(
        employeesError?.message || 
        usersError?.message || 
        couponsError?.message || 
        appointmentsError?.message
      );
    }

    // 3. Processamento dos dados para os gráficos
    // Funcionários (ativos/inativos)
    const employeesStatus = {
      active: employeesData.filter(e => e.is_active).length,
      inactive: employeesData.filter(e => !e.is_active).length
    };

    // Usuários (admin/comum)
    const usersDistribution = {
      admin: usersData.filter(u => u.tipo === 'admin').length,
      comum: usersData.filter(u => u.tipo === 'comum').length
    };

    // Cupons (ativos/inativos)
    const couponsStatus = {
      active: couponsData.filter(c => c.is_active).length,
      inactive: couponsData.filter(c => !c.is_active).length
    };

    // Agendamentos por mês
    const monthlyAppointments = Array(12).fill(0); // Janeiro a Dezembro
    appointmentsData.forEach(item => {
      const month = new Date(item.appointment_date).getMonth(); // 0-11
      monthlyAppointments[month]++;
    });

    // 4. Retornar todos os dados consolidados
    res.json({
      // Totais básicos
      totalEmployees: employeesCount || 0,
      totalCategories: categoriesCount || 0,
      totalServices: servicesCount || 0,
      totalAppointments: appointmentsCount || 0,
      
      // Dados para gráficos
      monthlyAppointments,
      employeesStatus,
      usersDistribution,
      couponsStatus,
      
      // Metadados
      lastUpdated: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// Rotas de Cupons
app.get('/api/coupons', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/coupons/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('id', req.params.id)
      .single();
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/coupons', async (req, res) => {
  try {
    const couponData = {
      ...req.body,
      code: req.body.code.toUpperCase()
    };
    
    const { data, error } = await supabase
      .from('coupons')
      .insert(couponData)
      .select()
      .single();
    
    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/coupons/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('coupons')
      .update(req.body)
      .eq('id', req.params.id)
      .select()
      .single();
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/coupons/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('coupons')
      .delete()
      .eq('id', req.params.id);
    
    if (error) throw error;
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/validate-coupon', async (req, res) => {
  try {
    const { code, serviceId } = req.query;
    const cleanCode = code.trim().toUpperCase();

    // Busca o serviço
    const { data: service, error: serviceError } = await supabase
      .from('services')
      .select('price, name')
      .eq('id', serviceId)
      .single();

    if (serviceError || !service) {
      return res.json({ valid: false, message: 'Serviço não encontrado' });
    }

    // Busca o cupom básico
    const { data: coupon, error: couponError } = await supabase
      .from('coupons')
      .select('*')
      .eq('code', cleanCode)
      .eq('is_active', true)
      .single();

    if (couponError || !coupon) {
      return res.json({ valid: false, message: 'Cupom não encontrado ou inativo' });
    }

    const now = new Date();

    // Valida data de validade
    if (coupon.valid_until && new Date(coupon.valid_until) < now) {
      return res.json({ valid: false, message: 'Este cupom expirou' });
    }

    // Valida número máximo de usos
    if (coupon.max_uses !== null && coupon.current_uses >= coupon.max_uses) {
      return res.json({ valid: false, message: 'Este cupom atingiu o número máximo de usos' });
    }

    // Valida valor mínimo do serviço
    if (service.price < coupon.min_service_value) {
      return res.json({
        valid: false,
        message: `Este cupom requer serviço com valor mínimo de R$ ${coupon.min_service_value.toFixed(2)}`
      });
    }

    // Cupom válido
    return res.json({
      valid: true,
      discount: coupon.discount_value,
      discountType: coupon.discount_type,
      message: `Cupom aplicado! Desconto de ${coupon.discount_value}${coupon.discount_type === 'percentage' ? '%' : 'R$'}`
    });

  } catch (error) {
    console.error('Erro na validação:', error);
    return res.status(500).json({ valid: false, message: 'Erro interno ao validar cupom' });
  }
});

// Rota para relatório de receitas (atualizada)
app.get('/api/admin/revenue', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    // 1. Buscar todos os agendamentos concluídos
    let appointmentsQuery = supabase
      .from('appointments')
      .select('id, final_price, appointment_date, employee_id, employees(id, name, comissao)')
      .eq('status', 'confirmed'); // Considerar apenas agendamentos confirmados
    
    // Aplicar filtro de datas se existir (corrigido para usar appointment_date)
    if (start_date && end_date) {
      appointmentsQuery = appointmentsQuery
        .gte('appointment_date', start_date)
        .lte('appointment_date', end_date);
    }
    
    const { data: appointments, error: appointmentsError } = await appointmentsQuery;
    if (appointmentsError) throw appointmentsError;
    
    // 2. Buscar todos os funcionários para garantir que apareçam mesmo sem agendamentos
    const { data: employees, error: employeesError } = await supabase
      .from('employees')
      .select('id, name, comissao');
    
    if (employeesError) throw employeesError;
    
    // 3. Processar os dados para calcular métricas
    const employeesMap = new Map();
    let totalAppointments = 0;
    let totalRevenue = 0;
    let totalCommissions = 0;
    
    // Inicializar mapa com todos os funcionários
    employees.forEach(employee => {
      employeesMap.set(employee.id, {
        id: employee.id,
        name: employee.name,
        commission_rate: employee.comissao || 0,
        appointments_count: 0,
        total_revenue: 0,
        commission_value: 0,
        net_profit: 0
      });
    });
    
    // Processar agendamentos
    appointments.forEach(appointment => {
      totalAppointments++;
      
      const finalPrice = appointment.final_price || 0;
      totalRevenue += finalPrice;
      
      const employeeId = appointment.employee_id; // Usando employee_id diretamente
      if (!employeeId) return;
      
      const employee = employeesMap.get(employeeId);
      if (!employee) return;
      
      employee.appointments_count++;
      employee.total_revenue += finalPrice;
    });
    
    // Calcular comissões e lucro líquido para cada funcionário
    employeesMap.forEach(employee => {
      employee.commission_value = employee.total_revenue * (employee.commission_rate / 100);
      employee.net_profit = employee.total_revenue - employee.commission_value;
      
      totalCommissions += employee.commission_value;
    });
    
    // Converter o Map para array e ordenar por maior faturamento
    const details = Array.from(employeesMap.values())
      .sort((a, b) => b.total_revenue - a.total_revenue);
    
    // 4. Retornar os dados
    res.json({
      period: start_date && end_date 
        ? `${start_date} a ${end_date}` 
        : 'Todos os períodos',
      total_appointments: totalAppointments,
      total_revenue: totalRevenue,
      total_commissions: totalCommissions,
      details: details
    });
    
  } catch (error) {
    console.error('Error fetching revenue data:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// Rota para exportar relatório de receitas (opcional)
app.get('/api/admin/revenue/export', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    // Reutilizar a mesma lógica da rota principal
    let appointmentsQuery = supabase
      .from('appointments')
      .select('id, final_price, appointment_date, employees(id, name, comissao)')
      .eq('status', 'completed');
    
    if (start_date && end_date) {
      appointmentsQuery = appointmentsQuery
        .gte('appointment_date', start_date)
        .lte('appointment_date', end_date);
    }
    
    const { data: appointments, error: appointmentsError } = await appointmentsQuery;
    if (appointmentsError) throw appointmentsError;
    
    const { data: employees, error: employeesError } = await supabase
      .from('employees')
      .select('id, name, comissao');
    
    if (employeesError) throw employeesError;
    
    // Processar os dados (mesma lógica da rota principal)
    const employeesMap = new Map();
    employees.forEach(employee => {
      employeesMap.set(employee.id, {
        name: employee.name,
        commission_rate: employee.comissao || 0,
        appointments_count: 0,
        total_revenue: 0,
        commission_value: 0,
        net_profit: 0
      });
    });
    
    appointments.forEach(appointment => {
      const employeeId = appointment.employees?.id;
      if (!employeeId) return;
      
      const employee = employeesMap.get(employeeId);
      if (!employee) return;
      
      const finalPrice = appointment.final_price || 0;
      
      employee.appointments_count++;
      employee.total_revenue += finalPrice;
    });
    
    employeesMap.forEach(employee => {
      employee.commission_value = employee.total_revenue * (employee.commission_rate / 100);
      employee.net_profit = employee.total_revenue - employee.commission_value;
    });
    
    const details = Array.from(employeesMap.values())
      .sort((a, b) => b.total_revenue - a.total_revenue);
    
    // Criar arquivo Excel (usando a biblioteca exceljs)
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Relatório de Receitas');
    
    // Adicionar cabeçalhos
    worksheet.columns = [
      { header: 'Profissional', key: 'name', width: 30 },
      { header: 'Agendamentos', key: 'appointments_count', width: 15 },
      { header: 'Faturamento Total', key: 'total_revenue', width: 20, style: { numFmt: '"R$"#,##0.00' } },
      { header: 'Comissão (%)', key: 'commission_rate', width: 15 },
      { header: 'Valor Comissão', key: 'commission_value', width: 20, style: { numFmt: '"R$"#,##0.00' } },
      { header: 'Lucro Líquido', key: 'net_profit', width: 20, style: { numFmt: '"R$"#,##0.00' } }
    ];
    
    // Adicionar dados
    worksheet.addRows(details);
    
    // Adicionar totais
    const totalAppointments = details.reduce((sum, emp) => sum + emp.appointments_count, 0);
    const totalRevenue = details.reduce((sum, emp) => sum + emp.total_revenue, 0);
    const totalCommissions = details.reduce((sum, emp) => sum + emp.commission_value, 0);
    
    worksheet.addRow([]);
    worksheet.addRow({
      name: 'TOTAIS',
      appointments_count: totalAppointments,
      total_revenue: totalRevenue,
      commission_value: totalCommissions
    });
    
    // Configurar resposta
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=relatorio-receitas.xlsx'
    );
    
    await workbook.xlsx.write(res);
    res.end();
    
  } catch (error) {
    console.error('Error exporting revenue data:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// Upload de imagem com título
// Rota: upload de imagem
app.post('/api/galeria/upload', upload.single('imagem'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhuma imagem foi enviada' });
    }

    const { titulo } = req.body;
    if (!titulo) {
      return res.status(400).json({ error: 'Título é obrigatório' });
    }

    const imagem = `/uploads/${req.file.filename}`;

    const novaImagem = new Galeria({ titulo, imagem });
    await novaImagem.save();

    res.status(201).json({ 
      mensagem: 'Imagem salva com sucesso',
      imagem: novaImagem
    });
  } catch (err) {
    console.error('Erro ao salvar imagem:', err);
    res.status(500).json({ error: 'Erro ao salvar imagem' });
  }
});

// Listar todas as imagens da galeria
app.get('/api/galeria', async (req, res) => {
  try {
    const imagens = await Galeria.find({}).sort({ criadoEm: -1 });
    res.json(imagens);
  } catch (err) {
    console.error('Erro ao buscar imagens:', err);
    res.status(500).json({ error: 'Erro ao buscar imagens' });
  }
});

// Excluir uma imagem da galeria
app.delete('/api/galeria/:id', async (req, res) => {
  try {
    const imagem = await Galeria.findByIdAndDelete(req.params.id);

    if (!imagem) {
      return res.status(404).json({ error: 'Imagem não encontrada.' });
    }

    // Apaga o arquivo fisicamente
    const caminhoImagem = path.join(__dirname, 'public', imagem.imagem);
    if (fs.existsSync(caminhoImagem)) {
      fs.unlinkSync(caminhoImagem);
    }

    res.json({ message: 'Imagem excluída com sucesso.' });
  } catch (error) {
    console.error('Erro ao excluir imagem:', error);
    res.status(500).json({ error: 'Erro ao excluir imagem.' });
  }
});


// Iniciar o servidor
app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
  startWhatsappBot();
});