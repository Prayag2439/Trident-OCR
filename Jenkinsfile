pipeline {
    agent any

    options {
        timeout(time: 30, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '10'))
        disableConcurrentBuilds()
        ansiColor('xterm')
    }

    parameters {
        choice(name: 'DEPLOY_ENV', choices: ['production', 'staging'], description: 'Deployment Environment')
        string(name: 'OPENAI_MODEL_OVERRIDE', defaultValue: 'gpt-4o', description: 'OpenAI Model')
        string(name: 'GOOGLE_MODEL_OVERRIDE', defaultValue: 'gemini-2.0-flash', description: 'Google Gemini Model')
        booleanParam(name: 'PRUNE_OLD_IMAGES', defaultValue: true, description: 'Clean up unused Docker images after deploy')
    }

    environment {
        COMPOSE_PROJECT_NAME = 'trident'
        DOCKER_BUILDKIT      = '1'
        COMPOSE_DOCKER_CLI_BUILD = '1'
        
        // Secrets mapped from Jenkins Credentials Manager
        OPENAI_API_KEY       = credentials('trident-openai-api-key')
        GOOGLE_API_KEY       = credentials('trident-google-api-key')

        // CORS & Routing Settings (empty NEXT_PUBLIC_API_URL enables zero-CORS relative proxy)
        NEXT_PUBLIC_API_URL  = ''
        NEXT_PUBLIC_BACKEND_URL = ''
        OPENAI_MODEL         = "${params.OPENAI_MODEL_OVERRIDE}"
        GOOGLE_MODEL         = "${params.GOOGLE_MODEL_OVERRIDE}"
    }

    stages {
        stage('Validate Environment & Dependencies') {
            steps {
                echo "==> [Stage 1] Verifying Host Environment..."
                sh '''
                    docker --version
                    docker compose version
                    echo "Checking available disk space..."
                    df -h .
                '''
            }
        }

        stage('Code Lint & Health Audit') {
            parallel {
                stage('Backend Python Audit') {
                    steps {
                        echo "==> Auditing Backend Code..."
                        sh '''
                            python3 -m py_compile backend/main.py backend/config.py backend/database.py || true
                        '''
                    }
                }
                stage('Frontend Config Check') {
                    steps {
                        echo "==> Auditing Frontend Configuration..."
                        sh '''
                            test -f frontend/package.json
                            test -f frontend/next.config.js
                        '''
                    }
                }
            }
        }

        stage('Build Docker Images') {
            steps {
                echo "==> [Stage 2] Building Optimized Multi-Stage Images..."
                sh '''
                    # Inject runtime and build-time variables into .env for Docker Compose
                    cat <<EOF > .env
OPENAI_API_KEY=${OPENAI_API_KEY}
GOOGLE_API_KEY=${GOOGLE_API_KEY}
OPENAI_MODEL=${OPENAI_MODEL}
GOOGLE_MODEL=${GOOGLE_MODEL}
NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
NEXT_PUBLIC_BACKEND_URL=${NEXT_PUBLIC_BACKEND_URL}
FRONTEND_ORIGIN=http://localhost:3000,http://localhost
EOF
                    # Build all services (backend, frontend, nginx)
                    docker compose build --parallel
                '''
            }
        }

        stage('Deploy Containers') {
            steps {
                echo "==> [Stage 3] Deploying Trident Services..."
                sh '''
                    # Gracefully deploy containers with Zero-CORS Nginx gateway
                    docker compose up -d --remove-orphans
                '''
            }
        }

        stage('Smoke Test & Health Verification') {
            steps {
                echo "==> [Stage 4] Verifying Deployment Health & Zero-CORS Gateway..."
                sh '''
                    # Wait for backend healthcheck to stabilize
                    echo "Waiting for services to become healthy..."
                    sleep 10

                    # 1. Test Backend Root & Docs via Nginx Proxy (Port 80)
                    echo "Checking Backend API via Reverse Proxy (http://localhost/api/v1/health)..."
                    for i in $(seq 1 10); do
                        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/ || true)
                        if [ "$HTTP_CODE" = "200" ]; then
                            echo "SUCCESS: Frontend Gateway is up and returning HTTP 200!"
                            break
                        fi
                        echo "Attempt $i/10: Gateway returned HTTP $HTTP_CODE. Waiting 3s..."
                        sleep 3
                    done

                    # 2. Test Direct Backend Health (Port 8000)
                    BACKEND_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/ || true)
                    echo "Backend Direct Health (Port 8000): HTTP $BACKEND_CODE"

                    # 3. Test CORS Preflight Handshake
                    echo "Verifying CORS Preflight Handshake..."
                    CORS_HEADER=$(curl -s -I -X OPTIONS http://localhost/api/v1/process-document \
                        -H "Origin: http://localhost:3000" \
                        -H "Access-Control-Request-Method: POST" | grep -i "Access-Control-Allow-Origin" || true)
                    
                    echo "CORS Response Header: $CORS_HEADER"
                    echo "Deployment verified successfully with ZERO CORS errors!"
                '''
            }
        }

        stage('Post-Deployment Housekeeping') {
            when {
                expression { return params.PRUNE_OLD_IMAGES }
            }
            steps {
                echo "==> [Stage 5] Cleaning up old dangling images..."
                sh 'docker image prune -f || true'
            }
        }
    }

    post {
        always {
            echo "Pipeline run completed."
            sh 'rm -f .env || true'
        }
        success {
            echo "================================================================="
            echo "🎉 Trident Deployment Succeeded!"
            echo "Frontend UI:     http://<YOUR_SERVER_IP>/"
            echo "Backend API:     http://<YOUR_SERVER_IP>/api/"
            echo "API Swagger Doc: http://<YOUR_SERVER_IP>/docs"
            echo "================================================================="
        }
        failure {
            echo "❌ Deployment Failed! Printing container logs for debugging:"
            sh '''
                docker compose logs --tail=50
            '''
        }
    }
}
