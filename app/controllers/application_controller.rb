class ApplicationController < ActionController::Base
  include ActionController::Live

  def index
  end

  def stream
    response.headers['Content-Type'] = 'text/event-stream'
    20.times do |idx|
      logger.info "sending #{idx}"
      response.stream.write "#{ {idx: idx}.to_json }\n"
      sleep 0.5
    end
    response.stream.close
  end
end
