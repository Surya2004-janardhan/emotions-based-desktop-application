backend and frontend collection plan and requirements to this task 

the electron application must run continously as a bg service and should not be visible to the user unless he opens it manually

when the user opens the application it should show a dashboard with the following features:

1. the live recording camera thing that is happeing along with the audio being recording live 
2. auto mode on or off it tells whether the application shd run as bg service or not 
3. when the auto service is on the service automatically invokes the analysis of the video and audio and stores the result in the local application data that is persistant the timer set for 15 or 30 is set by the user where for a reguarl interval of time till the app if closed the bg service invokes the recording in the set intervals and starts the service exactly for specifi time as uesr set 
4. user sets amount of time the service must record for the reguarl interval time of 15 or 30 once user sets it also with 5 - 10 mins it captures taht 10 min and runs services then goes to slep after that again waits for 15min since the interval is set for that time 
5. the recorded part ends both audio vedio goes to bg processing where it is processed and the result is stored in the local application data that is persistant 
6. when there is huge shift in the emotiomal termporal transition the system must knw the shift send a notification to the user and ask him to play the mapped intervention playlist if the user sets the option to auto play it plays automatically after the notification if user sets the setting to take permission then based on the reply of notification the thing happens notifiications shd be system notification not application based where the notification overally all the services that happen on the screen so we knw it poppeing and user can see 
7. calender part where the user can see the results of the analysis of the previous days weeks months hourly based 
8. when the user runs the analyssi part of calender with the time period setting today this week this month or all time so that the cognative runs analysis the temporal thing so tell user whether the change so that user can knw that shift happend on those days on those hours 
9. settings part where the user can change the settings of the application all these timely configs settings shd be persistant and shd be loaded when the user opens the application 
10. according these frontend electron app requirements use our backend services that are now rm some services if not requried at all 
11. backend service runs as child process gets invoked only when the processing needed to be done so that we dn consume the system services for backend much 
12. we dn use facny names over the site so we dn confuse the user 
13. goal is to find emotionla shift give support to indvuiales to reduce stress like things as well 
14. the timely analysis when user wants were done using ai call where the data is sent to llm over groq to analysis with strong system prompt so that the results are again persistent to application locally so that user can wish to use old results on that day 
15. improvements are celebrated too much sad is encouraged to user 
