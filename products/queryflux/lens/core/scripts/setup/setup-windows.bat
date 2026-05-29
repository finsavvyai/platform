@echo off
REM QueryLens Setup Script for Windows
REM This script sets up the QueryLens environment on Windows

setlocal enabledelayedexpansion

echo ======================================================
echo          QueryLens Setup Script for Windows
echo ======================================================
echo.

REM Check if running as administrator
net session >nul 2>&1
if %errorLevel% == 0 (
    echo Running as Administrator - Good!
) else (
    echo WARNING: Not running as Administrator. Some installations may fail.
    echo Consider running as Administrator for best results.
    pause
)

echo.
echo Checking system requirements...

REM Check for Java
java -version >nul 2>&1
if %errorLevel% == 0 (
    echo [32m+ Java found[0m
    for /f "tokens=3" %%g in ('java -version 2^>^&1 ^| findstr /i "version"') do (
        set JAVA_VERSION=%%g
        set JAVA_VERSION=!JAVA_VERSION:"=!
        for /f "delims=." %%a in ("!JAVA_VERSION!") do set JAVA_MAJOR=%%a
        if !JAVA_MAJOR! GEQ 17 (
            echo [32m+ Java !JAVA_VERSION! is compatible[0m
        ) else (
            echo [31m- Java !JAVA_VERSION! found, but Java 17+ required[0m
            goto :install_java
        )
    )
) else (
    echo [31m- Java not found[0m
    goto :install_java
)
goto :check_maven

:install_java
echo.
echo Java 17+ is required. Please install Java manually:
echo 1. Download OpenJDK 21 from: https://adoptium.net/
echo 2. Install and add to PATH
echo 3. Restart this script
echo.
pause
exit /b 1

:check_maven
REM Check for Maven
mvn -version >nul 2>&1
if %errorLevel% == 0 (
    echo [32m+ Maven found[0m
) else (
    echo [31m- Maven not found[0m
    echo.
    echo Maven is required. Please install Maven manually:
    echo 1. Download Maven from: https://maven.apache.org/download.cgi
    echo 2. Extract and add bin directory to PATH
    echo 3. Restart this script
    echo.
    pause
    exit /b 1
)

REM Check for curl (Windows 10+ includes curl)
curl --version >nul 2>&1
if %errorLevel% == 0 (
    echo [32m+ curl found[0m
) else (
    echo [31m- curl not found[0m
    echo curl is required for API testing. Please install curl or use Windows 10+
)

echo.
echo Building QueryLens application...
call mvn clean install -q
if %errorLevel% == 0 (
    echo [32m+ QueryLens built successfully[0m
) else (
    echo [31m- Failed to build QueryLens[0m
    pause
    exit /b 1
)

echo.
echo Creating startup scripts...

REM Create start script
echo @echo off > start-querylens.bat
echo setlocal >> start-querylens.bat
echo. >> start-querylens.bat
echo echo Starting QueryLens... >> start-querylens.bat
echo echo Available profiles: h2 ^(default^), postgresql, duckdb >> start-querylens.bat
echo echo Usage: start-querylens.bat [profile] >> start-querylens.bat
echo echo. >> start-querylens.bat
echo. >> start-querylens.bat
echo set PROFILE=%%1 >> start-querylens.bat
echo if "%%PROFILE%%" == "" set PROFILE=h2 >> start-querylens.bat
echo echo Using profile: %%PROFILE%% >> start-querylens.bat
echo. >> start-querylens.bat
echo REM Check if already running >> start-querylens.bat
echo netstat -an ^| find ":8080" ^>nul >> start-querylens.bat
echo if %%errorLevel%% == 0 ^( >> start-querylens.bat
echo     echo QueryLens is already running on port 8080 >> start-querylens.bat
echo     echo Stop it first with: stop-querylens.bat >> start-querylens.bat
echo     pause >> start-querylens.bat
echo     exit /b 1 >> start-querylens.bat
echo ^) >> start-querylens.bat
echo. >> start-querylens.bat
echo echo Starting QueryLens in background... >> start-querylens.bat
echo start /b /min cmd /c "mvn spring-boot:run -Dspring.profiles.active=%%PROFILE%% > querylens.log 2>&1" >> start-querylens.bat
echo. >> start-querylens.bat
echo echo Waiting for application to be ready... >> start-querylens.bat
echo for /l %%%%i in ^(1,1,30^) do ^( >> start-querylens.bat
echo     timeout /t 2 /nobreak ^>nul >> start-querylens.bat
echo     curl -s http://localhost:8080/ ^>nul 2^>^&1 >> start-querylens.bat
echo     if %%errorLevel%% == 0 ^( >> start-querylens.bat
echo         echo [32m+ QueryLens is ready^^![0m >> start-querylens.bat
echo         echo Web interface: http://localhost:8080 >> start-querylens.bat
echo         echo API base URL: http://localhost:8080/api >> start-querylens.bat
echo         echo H2 Console ^(if using H2^): http://localhost:8080/h2-console >> start-querylens.bat
echo         echo. >> start-querylens.bat
echo         echo To stop: stop-querylens.bat >> start-querylens.bat
echo         echo To view logs: type querylens.log >> start-querylens.bat
echo         pause >> start-querylens.bat
echo         exit /b 0 >> start-querylens.bat
echo     ^) >> start-querylens.bat
echo     echo ^| set /p=. >> start-querylens.bat
echo ^) >> start-querylens.bat
echo. >> start-querylens.bat
echo echo. >> start-querylens.bat
echo echo [31m- QueryLens failed to start within 60 seconds[0m >> start-querylens.bat
echo echo Check querylens.log for details >> start-querylens.bat
echo pause >> start-querylens.bat
echo exit /b 1 >> start-querylens.bat

REM Create stop script
echo @echo off > stop-querylens.bat
echo echo Stopping QueryLens... >> stop-querylens.bat
echo. >> stop-querylens.bat
echo REM Find and kill process using port 8080 >> stop-querylens.bat
echo for /f "tokens=5" %%%%a in ^('netstat -ano ^| find ":8080"'^) do ^( >> stop-querylens.bat
echo     taskkill /pid %%%%a /f ^>nul 2^>^&1 >> stop-querylens.bat
echo     if %%errorLevel%% == 0 ^( >> stop-querylens.bat
echo         echo QueryLens stopped ^(PID: %%%%a^) >> stop-querylens.bat
echo     ^) else ^( >> stop-querylens.bat
echo         echo Failed to stop QueryLens process %%%%a >> stop-querylens.bat
echo     ^) >> stop-querylens.bat
echo ^) >> stop-querylens.bat
echo. >> stop-querylens.bat
echo REM Also try to kill any Java processes running Maven >> stop-querylens.bat
echo taskkill /f /fi "IMAGENAME eq java.exe" /fi "WINDOWTITLE eq *spring-boot:run*" ^>nul 2^>^&1 >> stop-querylens.bat
echo. >> stop-querylens.bat
echo echo QueryLens stop command completed >> stop-querylens.bat
echo pause >> stop-querylens.bat

REM Create test script
copy final-test.sh test-querylens.bat >nul 2>&1
if not exist test-querylens.bat (
    echo @echo off > test-querylens.bat
    echo echo Running QueryLens tests... >> test-querylens.bat
    echo echo. >> test-querylens.bat
    echo echo Please ensure QueryLens is running first: >> test-querylens.bat
    echo echo   start-querylens.bat >> test-querylens.bat
    echo echo. >> test-querylens.bat
    echo echo Then run the test script manually: >> test-querylens.bat
    echo echo   bash final-test.sh >> test-querylens.bat
    echo echo. >> test-querylens.bat
    echo echo ^(Requires Git Bash or WSL for bash support^) >> test-querylens.bat
    echo pause >> test-querylens.bat
)

echo [32m+ Startup scripts created[0m

echo.
echo Creating configuration file...

echo REM QueryLens Configuration for Windows > querylens-config.bat
echo @echo off >> querylens-config.bat
echo. >> querylens-config.bat
echo REM Default settings >> querylens-config.bat
echo set QUERYLENS_PORT=8080 >> querylens-config.bat
echo set QUERYLENS_PROFILE=h2 >> querylens-config.bat
echo. >> querylens-config.bat
echo REM H2 Database settings >> querylens-config.bat
echo set H2_URL=jdbc:h2:mem:querylens >> querylens-config.bat
echo set H2_USERNAME=sa >> querylens-config.bat
echo set H2_PASSWORD= >> querylens-config.bat
echo. >> querylens-config.bat
echo REM PostgreSQL settings ^(uncomment and modify as needed^) >> querylens-config.bat
echo REM set POSTGRES_URL=jdbc:postgresql://localhost:5432/querylens >> querylens-config.bat
echo REM set POSTGRES_USERNAME=querylens >> querylens-config.bat
echo REM set POSTGRES_PASSWORD=querylens >> querylens-config.bat
echo. >> querylens-config.bat
echo REM NLP Service settings >> querylens-config.bat
echo set NLP_SERVICE_URL=http://localhost:5000 >> querylens-config.bat
echo. >> querylens-config.bat
echo echo QueryLens configuration loaded >> querylens-config.bat

echo [32m+ Configuration file created[0m

REM Create README for Windows
echo QueryLens - Windows Setup > README-Windows.txt
echo =============================== >> README-Windows.txt
echo. >> README-Windows.txt
echo This folder contains QueryLens setup for Windows. >> README-Windows.txt
echo. >> README-Windows.txt
echo QUICK START: >> README-Windows.txt
echo 1. Run setup-windows.bat ^(this file^) >> README-Windows.txt
echo 2. Run start-querylens.bat >> README-Windows.txt
echo 3. Open http://localhost:8080 in your browser >> README-Windows.txt
echo 4. Run test-querylens.bat to test functionality >> README-Windows.txt
echo. >> README-Windows.txt
echo REQUIREMENTS: >> README-Windows.txt
echo - Java 17 or higher >> README-Windows.txt
echo - Maven 3.6 or higher >> README-Windows.txt
echo - Windows 10 or higher ^(for curl support^) >> README-Windows.txt
echo. >> README-Windows.txt
echo DATABASE PROFILES: >> README-Windows.txt
echo - H2 ^(default^):      start-querylens.bat h2 >> README-Windows.txt
echo - PostgreSQL:        start-querylens.bat postgresql >> README-Windows.txt
echo - DuckDB:            start-querylens.bat duckdb >> README-Windows.txt
echo. >> README-Windows.txt
echo USEFUL COMMANDS: >> README-Windows.txt
echo - Start:             start-querylens.bat >> README-Windows.txt
echo - Stop:              stop-querylens.bat >> README-Windows.txt
echo - Test:              test-querylens.bat >> README-Windows.txt
echo - View logs:         type querylens.log >> README-Windows.txt
echo - Configuration:     querylens-config.bat >> README-Windows.txt
echo. >> README-Windows.txt
echo TROUBLESHOOTING: >> README-Windows.txt
echo - If Java not found: Install from https://adoptium.net/ >> README-Windows.txt
echo - If Maven not found: Install from https://maven.apache.org/ >> README-Windows.txt
echo - If curl not found: Use Windows 10+ or install Git Bash >> README-Windows.txt
echo - If port 8080 busy: Run stop-querylens.bat first >> README-Windows.txt

echo.
echo ======================================================
echo            QueryLens Setup Complete!
echo ======================================================
echo.
echo [32mQuick Start:[0m
echo 1. Start QueryLens:        start-querylens.bat
echo 2. Open web interface:     http://localhost:8080
echo 3. Run tests:             test-querylens.bat
echo 4. Stop QueryLens:        stop-querylens.bat
echo.
echo [32mDatabase Profiles:[0m
echo • H2 (default):           start-querylens.bat h2
echo • PostgreSQL:             start-querylens.bat postgresql
echo • DuckDB:                 start-querylens.bat duckdb
echo.
echo [32mUseful Files:[0m
echo • Configuration:          querylens-config.bat
echo • Windows Help:           README-Windows.txt
echo • Application logs:       querylens.log
echo.
echo [32mSetup completed successfully! 🎉[0m
echo Run start-querylens.bat to begin!
echo.
pause