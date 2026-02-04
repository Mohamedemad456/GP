# Start with the Spark image
FROM jupyter/pyspark-notebook:spark-3.3.0

# Switch to root to install system packages
USER root

# --- 1. INSTALL GOOGLE CHROME (For Selenium) ---
# We add Google's key, add the repo, and install the stable browser
RUN apt-get update && apt-get install -y wget gnupg2 && \
    wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - && \
    sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list' && \
    apt-get update && \
    apt-get install -y google-chrome-stable

# --- 2. INSTALL PYTHON LIBRARIES ---
# Added 'selenium' and 'webdriver-manager' to the list
RUN pip install --no-cache-dir \
    kafka-python \
    playwright \
    selenium \
    webdriver-manager \
    lxml \
    beautifulsoup4 \
    pandas

# --- 3. INSTALL PLAYWRIGHT BROWSERS ---
# This installs the browsers specifically for Playwright
RUN playwright install chromium
RUN playwright install-deps chromium

# --- 4. SETUP WORKSPACE ---
WORKDIR /home/jovyan/work

# Final clean up to keep image size down (Optional)
RUN apt-get clean && rm -rf /var/lib/apt/lists/*