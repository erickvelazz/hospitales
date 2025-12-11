pipeline {
    agent any

    stages {
        // Parar los servicios que ya existen o en todo caso hacer caso omiso
        stage('Parando los servicios...') {
            steps {
                sh '''
                    docker compose -p demo down || true
                '''
            }
        }

        // Eliminar las imágenes creadas por ese proyecto
        stage('Eliminando imágenes anteriores...') {
            steps {
                sh '''
                    images=$(docker images --filter "label=com.docker.compose.project=demo" -q)
                    if [ -z "$images" ]; then
                        echo "No hay imagenes por eliminar"
                    else
                        docker rmi -f $images
                        echo "Imagenes eliminadas correctamente"
                    fi
                '''
            }
        }

        // Del recurso SCM configurado en el job, jala el repo
        stage('Obteniendo actualización...') {
            steps {
                checkout scm
            }
        }

        stage('Preparando red y volumen...') {
            steps {
                sh '''
                    docker volume create certbot-certs || true
                    docker network create demo-net || true
                '''
            }
        }

        // Construir y levantar los servicios
        stage('Construyendo y desplegando servicios...') {
            steps {
                sh '''
                    docker compose -p demo up --build -d
                '''
            }
        }
    }

    post {
        success {
            echo 'Pipeline ejecutado con éxito'
        }
        failure {
            echo 'Hubo un error al ejecutar el pipeline'
        }
        always {
            echo 'Pipeline finalizado'
        }
    }
}
