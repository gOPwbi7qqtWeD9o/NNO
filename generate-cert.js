const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const certsDir = path.join(__dirname, 'certs')

// Create certs directory if it doesn't exist
if (!fs.existsSync(certsDir)) {
  fs.mkdirSync(certsDir)
}

console.log('Generating self-signed SSL certificate...')

try {
  // Generate private key
  execSync(`openssl genrsa -out ${path.join(certsDir, 'key.pem')} 2048`, { stdio: 'inherit' })
  
  // Generate certificate
  execSync(`openssl req -new -x509 -key ${path.join(certsDir, 'key.pem')} -out ${path.join(certsDir, 'cert.pem')} -days 365 -subj "/C=US/ST=Dev/L=Local/O=Terminal Chat/CN=localhost"`, { stdio: 'inherit' })
  
  console.log('✅ SSL certificate generated successfully!')
  console.log('📁 Certificate files created in: ./certs/')
  console.log('🔐 cert.pem - Certificate file')
  console.log('🗝️  key.pem - Private key file')
  
} catch (error) {
  console.error('❌ Error generating certificate:', error.message)
  console.log('\n💡 Alternative: Use mkcert for trusted local certificates')
  console.log('Install mkcert: https://github.com/FiloSottile/mkcert')
  console.log('Then run: npm run cert:mkcert')
}
