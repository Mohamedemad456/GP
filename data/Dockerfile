# Start with the Spark image
FROM jupyter/pyspark-notebook:spark-3.3.0

# Switch to root to install system packages
USER root

# 1. Update pip and install Python libraries
# We include 'lxml' here since you wanted it for speed
RUN pip install --no-cache-dir \
    kafka-python \
    playwright \
    lxml \
    beautifulsoup4 \
    pandas

# 2. Install Playwright Browsers & Dependencies
# This automatically downloads Chromium and all the Linux libraries needed to run it.
RUN playwright install chromium
RUN playwright install-deps chromium

# 3. Set the working directory
WORKDIR /home/jovyan/work

# (Optional) Switch back to the default user if you prefer, 
# but keeping root avoids permission issues with some scripts.
# USER jovyan