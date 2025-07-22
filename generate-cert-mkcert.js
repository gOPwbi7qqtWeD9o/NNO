const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const certsDir = path.join(__dirname, 'certs')

// Create certs directory if it doesn't exist
if (!fs.existsSync(certsDir)) {
  fs.mkdirSync(certsDir)
}

console.log('Generating trusted SSL certificate with mkcert...')

try {
  // Check if mkcert is installed
  execSync('mkcert -version', { stdio: 'pipe' })
  
  // Generate certificate for localhost
  execSync(`mkcert -key-file ${path.join(certsDir, 'key.pem')} -cert-file ${path.join(certsDir, 'cert.pem')} localhost 127.0.0.1 ::1`, { 
    stdio: 'inherit',
    cwd: certsDir 
  })
  
  console.log('✅ Trusted SSL certificate generated successfully!')
  console.log('📁 Certificate files created in: ./certs/')
  console.log('🔐 cert.pem - Certificate file')
  console.log('🗝️  key.pem - Private key file')
  console.log('🌟 This certificate is trusted by your browser!')
  
} catch (error) {
  console.error('❌ mkcert not found or error occurred:', error.message)
  console.log('\n💡 Install mkcert first:')
  console.log('Windows: choco install mkcert')
  console.log('macOS: brew install mkcert')
  console.log('Linux: See https://github.com/FiloSottile/mkcert#installation')
  console.log('\nThen run: mkcert -install')
}
