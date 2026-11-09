pipeline {
    agent any
    environment {
        HOST = "187.124.20.36"
        USER = "ubuntu"
        SCRIPT = "/home/ubuntu/projects/noda-voice-front/deploy.sh"
    }
    stages {
        stage('Deploy') {
            steps {
                sshagent(['servercreds']) {
                    sh """
                    ssh -o StrictHostKeyChecking=no ${USER}@${HOST} 'bash ${SCRIPT}'
                    """
                }
            }
        }
    }
}