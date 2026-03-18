FROM nginx:alpine
# Copy static frontend files to Nginx's web root
COPY . /usr/share/nginx/html

# Expose port 80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
