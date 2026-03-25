import { spawn } from 'node:child_process'
import process from 'node:process'

class ProjectRunner {
  constructor() {
    if (process.platform === 'win32') {
      this.command = 'cmd.exe'
      this.args = ['/c', 'npm.cmd', 'run', 'dev', '--', '--host']
    } else {
      this.command = 'npm'
      this.args = ['run', 'dev', '--', '--host']
    }
  }

  run() {
    const child = spawn(this.command, this.args, {
      cwd: process.cwd(),
      stdio: 'inherit',
      shell: false,
    })

    child.on('error', (error) => {
      console.error('Proje baslatilamadi:', error.message)
      process.exit(1)
    })

    child.on('exit', (code) => {
      process.exit(code ?? 0)
    })
  }
}

const runner = new ProjectRunner()
runner.run()
