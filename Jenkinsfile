pipeline {
  agent any

  tools {
    nodejs 'nodejs-20'
    jdk 'jdk-17'
  }

  stages {
    stage('Contracts') {
      steps {
        dir('.') {
          sh 'npm ci'
          sh 'npm run compile'
          sh 'npm test'
        }
      }
    }

    stage('Backend') {
      steps {
        dir('backend') {
          sh 'chmod +x mvnw'
          sh './mvnw -B verify'
        }
      }
    }

    stage('Frontend') {
      steps {
        dir('frontend') {
          sh 'npm ci'
          sh 'npm run build'
        }
      }
    }
  }
}
