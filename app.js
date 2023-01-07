const express = require("express");
const app = express();
const csrf = require("tiny-csrf");
const cookieParser = require("cookie-parser");

//importing all the required models
const { adminData, electionData, questionData, optionData, voterData } = require("./models");

const bodyParser = require("body-parser");
const path = require("path");
const bcrypt = require("bcrypt");
const passport = require("passport");
const connectEnsureLogin = require("connect-ensure-login");
const session = require("express-session");


//flash is used to show message if any error occurs while performing tasks in website
const flash = require("connect-flash");
const LocalStrategy = require("passport-local");

const saltRounds = 10;

app.set("views", path.join(__dirname, "views"));
app.use(flash());
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser("Some secret String"));
app.use(csrf("this_should_be_32_character_long", ["POST", "PUT", "DELETE"]));

app.use(
  session({
    secret: "my-super-secret-key-2837428907583420",
    cookie: {
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);
app.use((request, response, next) => {
  response.locals.messages = request.flash();
  next();
});
app.use(passport.initialize());
app.use(passport.session());

//creating a passport session for admin
passport.use(
  "adminData",
  new LocalStrategy(
    {
      usernameField: "Email",
      passwordField: "password",
    },
    (username, password, done) => {
        adminData.findOne({ where: { Email: username } })
        .then(async (user) => {
          const result = await bcrypt.compare(password, user.password);
          if (result) {
            return done(null, user);
          } else {
            done(null, false, { message: "Enter a valid password .." });
          }
        })
        .catch((err) => {
          console.log(err);
          return done(null, false, {
            message: "Please signup if you are a new User.." 
          });
        });
    }
  )
);

//creating a passport session for voter
passport.use(
  "voterData",
  new LocalStrategy(
    {
      usernameField: "votername",
      passwordField: "password",
      passReqToCallback: true,
    },
    async (request, username, password, done) => {
      const election = await electionData.GetUrl(request.params.url);
      voterData.findOne({ where: { votername: username, EID: election.id } })
        .then(async (user) => {
          const result = await bcrypt.compare(password, user.password);
          if (result) {
            return done(null, user);
          } else {
            return done(null, false, { message: "Enter a valid password..." });
          }
        })
        .catch(() => {
          return done(null, false, { message: "This voter is not registered..." });
        });
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, { id: user.id, role: user.role });
});
passport.deserializeUser((id, done) => {
  if (id.role === "admin") {
    adminData.findByPk(id.id)
      .then((user) => {
        done(null, user);
      })
      .catch((error) => {
        done(error, null);
      });
  } else if (id.role === "voter") {
    voterData.findByPk(id.id)
      .then((user) => {
        done(null, user);
      })
      .catch((error) => {
        done(error, null);
      });
  }
});


//setting up viewengine as ejs and using dirname
app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

//The Online Voting System Code starts Now

//Home Page
app.get("/", (request, response) => {
  if (request.user) {
    if (request.user.role === "admin") {
      return response.redirect("/elections");
    } else if (request.user.role === "voter") {
      request.logout((err) => {
        if (err) {
          return response.json(err);
        }
        response.redirect("/");
      });
    }
  } else {
    response.render("index", {
      title: "voting system",
      csrfToken: request.csrfToken(),
    });
  }
});

//Elections Home Page
//Home Page for Elections
app.get(
  "/elections",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.user.role === "admin") {
      let Electionuser = request.user.firstName + " " + request.user.lastName;
      try {
        const elections = await electionData.GetElections(request.user.id);
        if (request.accepts("html")) {
          response.render("elections", {
            title: "Online Voting System",
            Electionuser: Electionuser,
            elections,
            csrfToken: request.csrfToken(),
          });
        } else {
          return response.json({
            elections,
          });
        }
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);

//Signup page for admin
app.get("/signup", (request, response) => {
  response.render("signup", {
    title: "Create Admin Account",
    csrfToken: request.csrfToken(),
  });
});

//Creating the Election admin account
app.post("/admin", async (request, response) => {
  if (!request.body.firstName) {
    request.flash("error", "Enter The First Name");
    return response.redirect("/signup");
  }
  if (!request.body.Email) {
    request.flash("error", "Enter The Email");
    return response.redirect("/signup");
  }
  if (!request.body.password) {
    request.flash("error", "Enter The password");
    return response.redirect("/signup");
  }
  if (request.body.password.length < 5) {
    request.flash("error", "Please choose length of password atleast 5 characters");
    return response.redirect("/signup");
  }
  const hashedPwd = await bcrypt.hash(request.body.password, saltRounds);
  try {
    const user = await adminData.addAdmin({
      firstName: request.body.firstName,
      lastName: request.body.lastName,
      Email: request.body.Email,
      password: hashedPwd,
    });
    request.login(user, (err) => {
      if (err) {
        console.log(err);
        response.redirect("/");
      } else {
        response.redirect("/elections");
      }
    });
  } catch (error) {
    request.flash("error", "email is already in use");
    return response.redirect("/signup");
  }
});

//login page for admin
app.get("/login", (request, response) => {
  if (request.user) {
    return response.redirect("/elections");
  }
  response.render("login", {
    title: "Login",
    csrfToken: request.csrfToken(),
  });
});


//voter login page
app.get("/onlinelection/:url/voter", async (request, response) => {
  try {
    if (request.user) {
      return response.redirect(`/onlinelection/${request.params.url}`);
    }
    const election = await electionData.GetUrl(request.params.url);
    if (election.launch && !election.stop) {
      return response.render("voterlogin", {
        title: "Voter login",
        url: request.params.url,
        EID: election.id,
        csrfToken: request.csrfToken(),
      });
    } else {
      request.flash("Election Ended");
      return response.render("result");
    }
  } catch (error) {
    console.log(error);
    return response.status(422).json(error);
  }
});

//login as admin
app.post(
  "/session",
  passport.authenticate("adminData", {
    failureRedirect: "/login",
    failureFlash: true,
  }),
  (request, response) => {
    response.redirect("/elections");
  }
);

//login voter
app.post(
  "/onlinelection/:url/voter",
  passport.authenticate("voterData", {
    failureFlash: true,
    failureRedirect: "back",
  }),
  async (request, response) => {
    return response.redirect(`/onlinelection/${request.params.url}`);
  }
);

//signout
app.get("/signout", (request, response, next) => {
  request.logout((err) => {
    if (err) {
      return next(err);
    }
    response.redirect("/");
  });
});

//password reset page
app.get(
  "/reset-password",
  connectEnsureLogin.ensureLoggedIn(),
  (request, response) => {
    if (request.user.role === "admin") {
      response.render("resetadminpass", {
        title: "reset admin password",
        csrfToken: request.csrfToken(),
      });
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);

//reset admin password
app.post(
  "/reset-password",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.user.role === "admin") {
      if (!request.body.old_password) {
        request.flash("error", "Please enter your old password");
        return response.redirect("/reset-password");
      }
      if (!request.body.new_password) {
        request.flash("error", "Please enter a new password");
        return response.redirect("/reset-password");
      }
      if (request.body.new_password.length < 5) {
        request.flash("error", "password length should be atleast 8");
        return response.redirect("/reset-password");
      }
      const hashedNewPwd = await bcrypt.hash(
        request.body.new_password,
        saltRounds
      );
      const result = await bcrypt.compare(
        request.body.old_password,
        request.user.password
      );
      if (result) {
        try {
          adminData.findOne({ where: { Email: request.user.Email } }).then(
            (user) => {
              user.passwordreset(hashedNewPwd);
            }
          );
          request.flash("success", "password changed successfully");
          return response.redirect("/elections");
        } catch (error) {
          console.log(error);
          return response.status(422).json(error);
        }
      } else {
        request.flash("error", "Old password did not match");
        return response.redirect("/reset-password");
      }
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);

//creating a new election
app.get(
  "/elections/new",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.user.role === "admin") {
      return response.render("Create-Election", {
        title: "Create-Election",
        csrfToken: request.csrfToken(),
      });
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);

//posting the contents to elections page
app.post(
  "/elections",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.user.role === "admin") {
      if(request.body.eName!==undefined){
        console.log(request.body.eName.length);
      }
      if (request.body.eName.length < 5) {
        request.flash("error", "The length of the Electionname must be atleast 3");
        return response.redirect("/elections/new");
      }
      if (request.body.url.length < 3) {
        request.flash("error", "The length of the url must be atleast 3");
        return response.redirect("/elections/new");
      }
      if (
        request.body.url.includes(" ") ||
        request.body.url.includes("\t") ||
        request.body.url.includes("\n")
      ) {
        request.flash("error", "Please don't give space for custom url");
        return response.redirect("/elections/new");
      }
      try {
        await electionData.createElection({
          ename: request.body.eName,
          url: request.body.url,
          AID: request.user.id,
        });
        return response.redirect("/elections");
      } catch (error) {
        request.flash("error", "Email is already in used");
        return response.redirect("/elections/new");
      }
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);


//Manage Elections Home Page
app.get(
  "/elections/:id",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.user.role === "admin") {
      try {
        const election = await electionData.GetElection(request.params.id);
        if (request.user.id !== election.AID) {
          request.flash("error", "Election ID is invalid");
          return response.redirect("/elections");
        }
        if (election.stop) {
          return response.render("result");
        }
        const TotalQuestions = await questionData.CountQuestions(
          request.params.id
        );
        const TotalVoters = await voterData.CountVoters(request.params.id);
        return response.render("manageelection", {
          id: request.params.id,
          title: election.eName,
          url: election.url,
          launch: election.launch,
          TQ: TotalQuestions,
          NV: TotalVoters,
          csrfToken: request.csrfToken(),
        });
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);

//Deleting the election
app.delete(
  "/elections/:id",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {    
    const election = await electionData.findByPk(request.params.id);    
    if (election.launch) {
      return response.json("Election is running you cannot edit now");
    }
    if (election.stop) {
      return response.json("Election ended");
    }  
    if (request.user.id !== election.AID) {
      request.flash("error", "Election ID is invalid");
      return response.redirect("/elections");
    }  
    const questions = await questionData.findAll({
      where: { EID: request.params.id },
    });

    // deleting the  questions annd  options  in election
    questions.forEach(async (Question) => {
      const options = await optionData.findAll({
        where: { QID: Question.id },
      });
      options.forEach(async (option) => {
        await Choices.destroy({ where: { id: option.id } });
      });
      await questionData.destroy({ where: { id: Question.id } });
    });

    //deleting all voters from  the  election
    const voters = await voterData.findAll({
      where: { EID: request.params.id },
    });
    voters.forEach(async (voter) => {
      await voterData.destroy({ where: { id: voter.id } });
    });

    try {
      await electionData.destroy({ where: { id: request.params.id } });
      return response.json({ ok: true });
    } catch (error) {
      console.log(error);
      response.send(error);
    }
  }
);

//Manage Questions Home page
app.get(
  "/elections/:id/questions",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.user.role === "admin") {
      try {
        const election = await electionData.GetElection(request.params.id);
        if (request.user.id !== election.AID) {
          request.flash("error", "Election ID is invalid");
          return response.redirect("/elections");
        }
        const questions = await questionData.GetQuestions(request.params.id);
        if (!election.launch && !election.stop) {
          if (request.accepts("html")) {
            return response.render("Question-homepage", {
              title: election.ename,
              id: request.params.id,
              questions: questions,
              csrfToken: request.csrfToken(),
            });
          } else {
            return response.json({
              questions,
            });
          }
        } else {
          if (election.stop) {
            request.flash("error", "Election ended");
          } else if (election.launch) {
            request.flash("error", "Election is running");
          }
          return response.redirect(`/elections/${request.params.id}/`);
        }
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);

//Adding the question for the Election
app.get(
  "/elections/:id/questions/create",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.user.role === "admin") {
      try {
        const election = await electionData.GetElection(request.params.id);
        if (request.user.id !== election.AID) {
          request.flash("error", "Election ID is invalid");
          return response.redirect("/elections");
        }
        if (!election.launched) {
          return response.render("Create-Question", {
            id: request.params.id,
            csrfToken: request.csrfToken(),
          });
        } else {
          if (election.stop) {
            request.flash("error", "Election ended");
            return response.redirect(`/elections/${request.params.id}/`);
          }
          request.flash("error", "Election is running");
          return response.redirect(`/elections/${request.params.id}/`);
        }
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);

//posting the contents to question 
app.post(
  "/elections/:id/questions/create",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.user.role === "admin") {
      if (request.body.question.length < 5) {
        request.flash("error", "question length should be atleast 5");
        return response.redirect(
          `/elections/${request.params.id}/questions/create`
        );
      }

      try {
        const election = await electionData.GetElection(request.params.id);
        if (request.user.id !== election.AID) {
          request.flash("error", "Election ID is invalid");
          return response.redirect("/elections");
        }
        if (election.launch) {
          request.flash("error", "Election is running");
          return response.redirect(`/elections/${request.params.id}/`);
        }
        if (election.stop) {
          request.flash("error", "Election ended");
          return response.redirect(`/elections/${request.params.id}/`);
        }
        const question = await questionData.createquestion({
          question: request.body.question,
          description: request.body.description,
          EID: request.params.id,
        });
        return response.redirect(
          `/elections/${request.params.id}/questions/${question.id}`
        );
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);

//Modifying the question
app.get(
  "/elections/:EID/questions/:QID/edit",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.user.role === "admin") {
      try {
        const election = await electionData.GetElection(request.params.EID);
        if (request.user.id !== election.AID) {
          request.flash("error", "Election ID is invalid");
          return response.redirect("/elections");
        }
        if (election.launch) {
          request.flash("error", "Election is running you cannot edit now");
          return response.redirect(`/elections/${request.params.id}/`);
        }
        if (election.stop) {
          request.flash("error", "Election ended");
          return response.redirect(`/elections/${request.params.id}/`);
        }
        const question = await questionData.GetQuestion(request.params.QID);
        return response.render("edit-questions", {
          EID: request.params.EID,
          QID: request.params.QID,
          question: question.question,
          description: question.description,
          csrfToken: request.csrfToken(),
        });
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);

//edit question
app.put(
  "/elections/:EID/questions/:QID/edit",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.user.role === "admin") {
      if (request.body.question.length < 5) {
        request.flash("error", "The length of question should be atleast 5");
        return response.json({
          error: "The length of question should be atleast 5",
        });
      }
      try {
        const election = await electionData.GetElection(request.params.EID);
        if (election.launched) {
          return response.json("Election is running you cannot edit now");
        }
        if (election.stop) {
          return response.json("Election ended");
        }
        if (request.user.id !== election.AID) {
          return response.json({
            error: "Election ID is invalid",
          });
        }
        const editquestion = await questionData.editQuestion({
          question: request.body.question,
          description: request.body.description,
          id: request.params.QID,
        });
        return response.json(editquestion);
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);

//delete question
app.delete(
  "/elections/:EID/questions/:QID",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.user.role === "admin") {
      try {
        const election = await electionData.GetElection(request.params.EID);
        if (election.launch) {
          return response.json("Election is running you cannot edit now");
        }
        if (election.stop) {
          return response.json("Election ended");
        }
        if (request.user.id !== election.AID) {
          request.flash("error", "Election ID is invalid");
          return response.redirect("/elections");
        }
        const NQ = await questionData.CountQuestions(
          request.params.EID
        );
        if (NQ > 1) {
          const res = await questionData.removequestion(request.params.QID);
          return response.json({ success: res === 1 });
        } else {
          return response.json({ success: false });
        }
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);

//question page
app.get(
  "/elections/:id/questions/:QID",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.user.role === "admin") {
      try {
        const question = await questionData.GetQuestion(request.params.QID);
        const options = await optionData.Getoptions(request.params.QID);
        const election = await electionData.GetElection(request.params.id);
        if (request.user.id !== election.AID) {
          request.flash("error", "Election ID is invalid");
          return response.redirect("/elections");
        }
        if (election.launch) {
          request.flash("error", "Election is running you cannot edit now");
          return response.redirect(`/elections/${request.params.id}/`);
        }
        if (election.stop) {
          request.flash("error", "Election ended");
          return response.redirect(`/elections/${request.params.id}/`);
        }
        if (request.accepts("html")) {
          response.render("options-page", {
            title: question.question,
            description: question.description,
            id: request.params.id,
            QID: request.params.QID,
            options,
            csrfToken: request.csrfToken(),
          });
        } else {
          return response.json({
            options,
          });
        }
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);

//Adding Options to Questions
app.post(
  "/elections/:id/questions/:QID",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.user.role === "admin") {
      if (!request.body.option) {
        request.flash("error", "Please enter option");
        return response.redirect(
          `/elections/${request.params.id}/questions/${request.params.QID}`
        );
      }
      try {
        const election = await electionData.GetElection(request.params.id);
        if (request.user.id !== election.AID) {
          request.flash("error", "Invalid election ID");
          return response.redirect("/elections");
        }
        if (election.launch) {
          request.flash("error", "Election is running you cannot edit now");
          return response.redirect(`/elections/${request.params.id}/`);
        }
        if (election.stop) {
          request.flash("error", "Election ended");
          return response.redirect(`/elections/${request.params.id}/`);
        }
        await optionData.addoption({
          choice: request.body.choice,
          QID: request.params.QID,
        });
        return response.redirect(
          `/elections/${request.params.id}/questions/${request.params.QID}`
        );
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);

//Deleting Options
app.delete(
  "/elections/:EID/questions/:QID/options/:OPID",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.user.role === "admin") {
      try {
        const election = await electionData.GetElection(request.params.EID);
        if (request.user.id !== election.AID) {
          request.flash("error", "Election ID is invalid");
          return response.redirect("/elections");
        }
        if (election.launch) {
          return response.json("Election is running you cannot edit now");
        }
        if (election.stop) {
          return response.json("Election ended");
        }
        const res = await optionData.removeoption(request.params.OPID);
        return response.json({ success: res === 1 });
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);

//Edit the options
app.get(
  "/elections/:EID/questions/:QID/options/:OPID/edit",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.user.role === "admin") {
      try {
        const election = await electionData.GetElection(request.params.EID);
        if (request.user.id !== election.AID) {
          request.flash("error", "Election ID is invalid");
          return response.redirect("/elections");
        }
        if (election.launch) {
          request.flash("error", "Election is running you cannot edit now");
          return response.redirect(`/elections/${request.params.id}/`);
        }
        if (election.stop) {
          request.flash("error", "Election ended");
          return response.redirect(`/elections/${request.params.id}/`);
        }
        const option = await optionData.Getoption(request.params.OPID);
        return response.render("edit-options", {
          option: option.choice,
          csrfToken: request.csrfToken(),
          EID: request.params.EID,
          QID: request.params.QID,
          OPID: request.params.OPID,
        });
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);

//update the edited options for a question in the election
app.put(
  "/elections/:EID/questions/:QID/options/:OPID/edit",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.user.role === "admin") {
      if (!request.body.option) {
        request.flash("error", "Please enter option");
        return response.json({
          error: "Please enter option",
        });
      }
      try {
        const election = await electionData.GetElection(request.params.EID);
        if (request.user.id !== election.AID) {
          request.flash("error", "Election ID is invalid");
          return response.redirect("/elections");
        }
        if (election.launch) {
          return response.json("Election is running you cannot edit now");
        }
        if (election.stop) {
          return response.json("Election ended");
        }
        const editoption = await optionData.editoption({
          id: request.params.OPID,
          option: request.body.choice,
        });
        return response.json(editoption);
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);

//Voters Page
app.get(
  "/elections/:EID/voters",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.user.role === "admin") {
      try {
        const voters = await voterData.GetVoters(request.params.EID);
        const election = await electionData.GetElection(request.params.EID);
        if (election.stop) {
          request.flash("error", "Election ended");
          return response.redirect(`/elections/${request.params.EID}/`);
        }
        if (request.user.id !== election.AID) {
          request.flash("error", "Election ID is invalid");
          return response.redirect("/elections");
        }
        if (request.accepts("html")) {
          return response.render("voters", {
            title: election.eName,
            id: request.params.EID,
            voters,
            csrfToken: request.csrfToken(),
          });
        } else {
          return response.json({
            voters,
          });
        }
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);

//Voters Page
app.get(
  "/elections/:EID/votedornot",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.user.role === "admin") {
      try {
        const voters = await voterData.GetVoters(request.params.EID);
        const election = await electionData.GetElection(request.params.EID);
        if (election.stop) {
          request.flash("error", "Election ended");
          return response.redirect(`/elections/${request.params.EID}/`);
        }
        if (request.user.id !== election.AID) {
          request.flash("error", "Election ID is invalid");
          return response.redirect("/elections");
        }
        if (request.accepts("html")) {
          return response.render("votedornot", {
            title: election.eName,
            id: request.params.EID,
            voters,
            csrfToken: request.csrfToken(),
          });
        } else {
          return response.json({
            voters,
          });
        }
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);

//Show Voter into voter Page
app.get(
  "/elections/:EID/voters/create",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.user.role === "admin") {
      try {
        const election = await electionData.GetElection(request.params.EID);
        if (request.user.id !== election.AID) {
          request.flash("error", "Election ID is invalid");
          return response.redirect("/elections");
        }
        if (election.stop) {
          request.flash("error", "Election ended");
          return response.redirect(`/elections/${request.params.EID}/`);
        }
        response.render("Create-Voter", {
          title: "add voter to the election",
          EID: request.params.EID,
          csrfToken: request.csrfToken(),
        });
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);

//add voter
app.post(
  "/elections/:EID/voters/create",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.user.role === "admin") {
      if (!request.body.votername) {
        request.flash("error", "Please enter voterID");
        return response.redirect(
          `/elections/${request.params.EID}/voters/create`
        );
      }
      if (!request.body.password) {
        request.flash("error", "Please enter correct password");
        return response.redirect(
          `/elections/${request.params.EID}/voters/create`
        );
      }
      if (request.body.password.length < 5) {
        request.flash("error", "The length of password should be atleast 5");
        return response.redirect(
          `/elections/${request.params.EID}/voters/create`
        );
      }
      const hashedPwd = await bcrypt.hash(request.body.password, saltRounds);
      try {
        const election = await electionData.GetElection(request.params.EID);
        if (request.user.id !== election.AID) {
          request.flash("error", "Election ID is invalid");
          return response.redirect("/elections");
        }
        if (election.stop) {
          request.flash("error", "Cannot edit when election has ended");
          return response.redirect(`/elections/${request.params.EID}/`);
        }
        await voterData.createVoter({
            voterId: request.body.voterId,
          password: hashedPwd,
          EID: request.params.EID,
        });
        return response.redirect(
          `/elections/${request.params.EID}/voters`
        );
      } catch (error) {
        request.flash("error", "Voter id is already created");
        return response.redirect(
          `/elections/${request.params.EID}/voters/create`
        );
      }
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);

//Delete the voter
app.delete(
  "/elections/:EID/voters/:VID",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.user.role === "admin") {
      try {
        const election = await electionData.GetElection(request.params.EID);
        if (request.user.id !== election.AID) {
          return response.json({
            error: "Election ID is invalid",
          });
        }
        if (election.stop) {
          return response.json("Cannot edit when election has ended");
        }
        const TV = await voterData.CountVoters(request.params.EID);
        if (TV > 1) {
          const voter = await voterData.GetVoter(request.params.VID);
          if (voter.isVoted) {
            return response.json("Already voted,cannot delete now");
          }
          const res = await voterData.removevoter(request.params.VID);
          return response.json({ success: res === 1 });
        } else {
          return response.json({ success: false });
        }
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);

//voter password reset page
app.get(
  "/elections/:EID/voters/:VID/edit",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.user.role === "admin") {
      try {
        const election = await electionData.GetElection(request.params.EID);
        const voter = await voterData.GetVoter(request.params.VID);
        if (voter.isVoted) {
          request.flash("error", "Already vote submitted");
          return response.redirect(
            `/elections/${request.params.EID}/voters`
          );
        }
        if (request.user.id !== election.AID) {
          request.flash("error", "Election ID is invalid");
          return response.redirect("/elections");
        }
        if (election.stop) {
          request.flash("error", "Election ended");
          return response.redirect(`/elections/${request.params.EID}/`);
        }
        response.render("resetpass-voter", {
          title: "reset voter password",
          EID: request.params.EID,
          VID: request.params.VID,
          csrfToken: request.csrfToken(),
        });
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);

//reset user password
app.post(
  "/elections/:EID/voters/:VID/edit",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.user.role === "admin") {
      if (!request.body.new_password) {
        request.flash("error", "Please Enter New password");
        return response.redirect("/reset-password");
      }
      if (request.body.new_password.length < 5) {
        request.flash("error", "password length should be atleast 5");
        return response.redirect("/reset-password");
      }
      const hashedNewPwd = await bcrypt.hash(
        request.body.new_password,
        saltRounds
      );
      try {
        const election = await electionData.GetElection(request.params.EID);
        if (request.user.id !== election.AID) {
          request.flash("error", "Election ID is invalid");
          return response.redirect("/elections");
        }
        if (election.stop) {
          request.flash("error", "Election ended");
          return response.redirect(`/elections/${request.params.EID}/`);
        }
        voterData.findOne({ where: { id: request.params.VID } }).then(
          (user) => {
            user.passwordreset(hashedNewPwd);
          }
        );
        request.flash("success", "Successfully changed the password");
        return response.redirect(
          `/elections/${request.params.EID}/voters`
        );
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);

//election preview
app.get(
  "/elections/:EID/checkbeforelaunch",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.user.role === "admin") {
      try {
        const election = await electionData.GetElection(request.params.EID);
        if (request.user.id !== election.AID) {
          request.flash("error", "Election ID is invalid");
          return response.redirect("/elections");
        }
        if (election.stop) {
          request.flash("error", "Election ended");
          return response.redirect(`/elections/${request.params.EID}/`);
        }
        const voters_count = await voterData.CountVoters(
          request.params.EID
        );
        const questions = await questionData.GetQuestions(
          request.params.EID
        );
        let options = [];
        for (let question in questions) {
          const question_options = await optionData.Getoptions(
            questions[question].id
          );
          if (question_options.length < 2) {
            request.flash(
              "error",
              "There should be atleast two options in each question"
            );
            request.flash(
              "error",
              "Please add atleast two options to the question below"
            );
            return response.redirect(
              `/elections/${request.params.EID}/questions/${questions[question].id}`
            );
          }
          options.push(question_options);
        }

        if (questions.length < 1) {
          request.flash(
            "error",
            "Please add atleast one question in the ballot"
          );
          return response.redirect(
            `/elections/${request.params.EID}/questions`
          );
        }

        if (voters_count < 1) {
          request.flash(
            "error",
            "Please add atleast one voter to the election"
          );
          return response.redirect(
            `/elections/${request.params.EID}/voters`
          );
        }

        return response.render("ChecktoLaunch", {
          title: election.eName,
          EID: request.params.EID,
          question,
          choice,
          csrfToken: request.csrfToken(),
        });
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);

//launch an election
app.put(
  "/elections/:EID/launch",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.user.role === "admin") {
      try {
        const election = await electionData.GetElection(request.params.EID);
        if (request.user.id !== election.AID) {
          return response.json({
            error: "Election ID is invalid",
          });
        }
        if (election.stop) {
          return response.json("Cannot launch when election has ended");
        }
        const launchElection = await electionData.electionLaunch(
          request.params.EID
        );
        return response.json(launchElection);
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);

//Ending a particular election
app.put(
  "/elections/:EID/end",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.user.role === "admin") {
      try {
        const election = await electionData.GetElection(request.params.EID);
        if (request.user.id !== election.AID) {
          return response.json({
            error: "Election ID is invalid",
          });
        }
        if (!election.launch) {
          return response.json("cannot end election since election not launched");
        }
        const endElection = await electionData.EndElection(
          request.params.EID
        );
        return response.json(endElection);
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);


//going to voter page
app.get("/onlinelection/:url/", async (request, response) => {
  if (!request.user) {
    request.flash("error", "Please login before trying to Vote");
    return response.redirect(`/onlinelection/${request.params.url}/voter`);
  }
  if (request.user.Voted) {
    request.flash("error", "You have voted successfully");
    return response.redirect(`/onlinelection/${request.params.url}/results`);
  }
  try {
    const election = await electionData.GetUrl(request.params.url);
    if (election.stop) {
      return response.redirect(`/elections/${request.params.id}/result`);
    }
    if (request.user.role === "voter") {
      if (election.launched) {
        const questions = await questionData.GetQuestions(election.id);
        let options = [];
        for (let question in questions) {
          options.push(await optionData.Getoptions(questions[question].id));
        }
        return response.render("votingpage", {
          title: election.eName,
          EID: election.id,
          questions,
          options,
          url: request.params.url,
          csrfToken: request.csrfToken(),
        });
      } else {
        return response.render("error");
      }
    } else if (request.user.role === "admin") {
      request.flash("error", "sorry you cannot vote as admin");
      request.flash("error", "Please signout as Admin before trying to vote");
      return response.redirect(`/elections/${election.id}`);
    }
  } catch (error) {
    console.log(error);
    return response.status(422).json(error);
  }
});

// app.post("/onlinelection/:url", async (request, response) => {
//   if (!request.user) {
//     request.flash("error", "Please login before trying to Vote");
//     return response.redirect(`/onlinelection/${request.params.url}/voter`);
//   }
//   if (request.user.isVoted) {
//     request.flash("error", "You have voted successfully");
//     return response.redirect(`/onlinelection/${request.params.url}/results`);
//   }
//   try {
//     let election = await electionData.GetUrl(request.params.url);
//     if (election.stop) {
//       request.flash("error", "Election has ended");
//       return response.redirect(`/elections/${request.params.id}/results`);
//     }
//     let questions = await electionData.GetQuestions(election.id);
//     for (let question of questions) {
//       let qid = `q-${question.id}`;
//       let voterchoice = request.body[qid];
//       await Voteresponses.addchoice({
//         VID: request.user.id,
//         EID: election.id,
//         QID: question.id,
//         voterchoice: voterchoice,
//       });
//       await Voters.markasvoted(request.user.id);
//       return response.redirect(`/onlinelection/${request.params.url}/results`);
//     }
//   } catch (error) {
//     console.log(error);
//     return response.status(422).json(error);
//   }
// });

app.get("/onlinelection/:url/results", async (request, response) => {
  if (!request.user) {
    request.flash("error", "Please login before viewing results");
    return response.redirect(`/onlinelection/${request.params.url}/voter`);
  }
  try {
    const election = await electionData.GetUrl(request.params.url);
    if (request.user.role === "voter") {
      if (!election.stop) {
        return response.render("feedback");
      }
      if (!request.user.isVoted) {
        request.flash("error", "You have not completed your vote");
        request.flash("error", "Please vote to view results");
        return response.redirect(`/onlinelection/${request.params.url}`);
      }
      return response.render("result");
    } else if (request.user.role === "admin") {
      if (request.user.id !== election.AID) {
        request.flash("error", "Election ID is invalid");
        return response.redirect("/elections");
      }
      return response.render("result");
    }
  } catch (error) {
    console.log(error);
    return response.status(422).json(error);
  }
});

app.use(function (request, response) {
  response.status(404).render("error");
});

module.exports = app;